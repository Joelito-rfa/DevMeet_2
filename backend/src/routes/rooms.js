import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { query, one } from '../db/pool.js';
import { parse, badRequest, forbidden, notFound } from '../utils/http.js';
import { publicUser, roomDto } from '../utils/serialize.js';
import { requireMember, requireAdmin, addMember, removeMember } from '../services/rooms.js';
import { listMessages, createMessage, roomUploadDir, isSafeFileName } from '../services/messages.js';
import { forgetBoard } from '../services/boardStore.js';
import { getIo, roomChannel, userChannel } from '../socket/io.js';
import { buildChatExport } from '../services/exporter.js';
import { config } from '../config.js';

const router = Router();

/** Liste des salons d'un utilisateur, avec compteurs de non-lus, membres et dernier message. */
export async function getRoomsForUser(userId, onlyRoomId = null) {
  const rows = await query(
    `SELECT r.*, rm.role, rm.starred, rm.last_read_message_id,
      (SELECT COUNT(*) FROM messages m WHERE m.room_id = r.id AND m.id > rm.last_read_message_id
         AND m.type = 'text' AND m.deleted_at IS NULL AND (m.user_id IS NULL OR m.user_id <> ?)) AS unread,
      (SELECT MAX(m2.id) FROM messages m2 WHERE m2.room_id = r.id AND m2.deleted_at IS NULL) AS last_message_id
     FROM rooms r JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = ?
     ${onlyRoomId ? 'WHERE r.id = ?' : ''}
     ORDER BY r.created_at`,
    onlyRoomId ? [userId, userId, onlyRoomId] : [userId, userId],
  );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const members = await query('SELECT room_id, user_id FROM room_members WHERE room_id IN (?)', [ids]);
  const byRoom = new Map();
  for (const m of members) {
    if (!byRoom.has(m.room_id)) byRoom.set(m.room_id, []);
    byRoom.get(m.room_id).push(m.user_id);
  }
  const lastIds = rows.map((r) => r.last_message_id).filter(Boolean);
  const lastMessages = new Map();
  if (lastIds.length) {
    const lm = await query(
      `SELECT m.id, m.room_id, m.content, m.type, m.attachment, m.created_at, m.user_id, u.display_name
       FROM messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.id IN (?)`,
      [lastIds],
    );
    for (const m of lm) {
      lastMessages.set(m.room_id, {
        id: m.id,
        content: m.content || (m.attachment ? `Pièce jointe : ${m.attachment.name}` : ''),
        type: m.type,
        authorId: m.user_id,
        authorName: m.display_name,
        createdAt: m.created_at,
      });
    }
  }
  const peerIds = rows
    .filter((r) => r.type === 'dm')
    .map((r) => (byRoom.get(r.id) || []).find((id) => id !== userId))
    .filter(Boolean);
  const peers = new Map();
  if (peerIds.length) {
    for (const u of await query('SELECT * FROM users WHERE id IN (?)', [peerIds])) peers.set(u.id, publicUser(u));
  }
  return rows.map((r) => {
    const memberIds = byRoom.get(r.id) || [];
    const peerId = r.type === 'dm' ? memberIds.find((id) => id !== userId) : null;
    return {
      ...roomDto(r),
      role: r.role,
      starred: !!r.starred,
      unread: Number(r.unread),
      lastReadMessageId: r.last_read_message_id,
      memberIds,
      lastMessage: lastMessages.get(r.id) || null,
      peer: peerId ? peers.get(peerId) || null : null,
    };
  });
}

router.get('/', async (req, res) => {
  const rooms = await getRoomsForUser(req.userId);
  const ids = [...new Set(rooms.flatMap((r) => r.memberIds))];
  const users = ids.length ? (await query('SELECT * FROM users WHERE id IN (?)', [ids])).map((u) => publicUser(u)) : [];
  res.json({ rooms, users });
});

router.get('/discover', async (req, res) => {
  const rows = await query(
    `SELECT r.*, (SELECT COUNT(*) FROM room_members x WHERE x.room_id = r.id) AS member_count
     FROM rooms r
     WHERE r.type = 'room' AND r.is_private = 0
       AND NOT EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = r.id AND rm.user_id = ?)
     ORDER BY member_count DESC LIMIT 50`,
    [req.userId],
  );
  res.json({ rooms: rows.map((r) => ({ ...roomDto(r), memberCount: Number(r.member_count) })) });
});

const roomSchema = z.object({
  name: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères').max(64),
  description: z.string().trim().max(255).nullable().optional(),
  icon: z.string().regex(/^[a-z][a-z0-9-]{0,30}$/, 'Icône invalide').nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  category: z.enum(['general', 'entraide', 'projet', 'brainstorming', 'detente', 'etude', 'autre']).optional(),
  isPrivate: z.boolean().optional(),
});

router.post('/', async (req, res) => {
  const data = parse(roomSchema, req.body);
  const result = await query(
    'INSERT INTO rooms (type, name, description, icon, color, category, is_private, owner_id) VALUES (?,?,?,?,?,?,?,?)',
    ['room', data.name, data.description || null, data.icon || 'message-circle', data.color || '#6366f1', data.category || 'autre', data.isPrivate === false ? 0 : 1, req.userId],
  );
  await addMember(result.insertId, req.userId, 'owner');
  const me = await one('SELECT display_name FROM users WHERE id = ?', [req.userId]);
  await createMessage({ roomId: result.insertId, type: 'system', content: `${me.display_name} a créé le salon` });
  const [room] = await getRoomsForUser(req.userId, result.insertId);
  res.status(201).json({ room });
});

router.post('/dm', async (req, res) => {
  const { userId } = parse(z.object({ userId: z.number().int().positive() }), req.body);
  if (userId === req.userId) throw badRequest('Impossible de vous écrire à vous-même');
  const peer = await one('SELECT id FROM users WHERE id = ?', [userId]);
  if (!peer) throw notFound('Utilisateur introuvable');
  const key = [req.userId, userId].sort((a, b) => a - b).join(':');
  let room = await one('SELECT id FROM rooms WHERE dm_key = ?', [key]);
  if (!room) {
    const result = await query(
      "INSERT INTO rooms (type, name, is_private, dm_key, icon, color) VALUES ('dm', 'Message privé', 1, ?, NULL, '#6366f1')",
      [key],
    );
    room = { id: result.insertId };
    await addMember(room.id, req.userId, 'member');
    await addMember(room.id, userId, 'member');
    getIo()?.to(userChannel(userId)).emit('room:added', { roomId: room.id });
  }
  const [dto] = await getRoomsForUser(req.userId, room.id);
  res.json({ room: dto });
});

router.get('/:id', async (req, res) => {
  const roomId = Number(req.params.id);
  await requireMember(roomId, req.userId);
  const [room] = await getRoomsForUser(req.userId, roomId);
  const members = await query(
    `SELECT u.*, rm.role, rm.joined_at, rm.last_read_message_id, rm.last_delivered_message_id
     FROM room_members rm JOIN users u ON u.id = rm.user_id WHERE rm.room_id = ?
     ORDER BY FIELD(rm.role,'owner','admin','member'), u.display_name`,
    [roomId],
  );
  res.json({
    room,
    members: members.map((m) => ({
      ...publicUser(m),
      role: m.role,
      joinedAt: m.joined_at,
      lastReadMessageId: Number(m.last_read_message_id),
      lastDeliveredMessageId: Number(m.last_delivered_message_id),
    })),
  });
});

router.patch('/:id', async (req, res) => {
  const roomId = Number(req.params.id);
  const { room } = await requireAdmin(roomId, req.userId);
  if (room.type === 'dm') throw badRequest('Un message privé ne peut pas être modifié');
  const data = parse(roomSchema.partial(), req.body);
  const map = { name: 'name', description: 'description', icon: 'icon', color: 'color', category: 'category' };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (data[k] !== undefined) {
      sets.push(`${col} = ?`);
      params.push(data[k]);
    }
  }
  if (data.isPrivate !== undefined) {
    sets.push('is_private = ?');
    params.push(data.isPrivate ? 1 : 0);
  }
  if (sets.length) await query(`UPDATE rooms SET ${sets.join(', ')} WHERE id = ?`, [...params, roomId]);
  const updated = await one('SELECT * FROM rooms WHERE id = ?', [roomId]);
  getIo()?.to(roomChannel(roomId)).emit('room:updated', roomDto(updated));
  res.json({ room: roomDto(updated) });
});

router.delete('/:id', async (req, res) => {
  const roomId = Number(req.params.id);
  const { membership, room } = await requireMember(roomId, req.userId);
  if (room.type === 'dm' || membership.role !== 'owner') throw forbidden('Seul le propriétaire peut supprimer le salon');
  const io = getIo();
  io?.to(roomChannel(roomId)).emit('room:deleted', { roomId });
  io?.in(roomChannel(roomId)).socketsLeave([roomChannel(roomId), `board:${roomId}`]);
  forgetBoard(roomId);
  await query('DELETE FROM rooms WHERE id = ?', [roomId]);
  fs.promises.rm(roomUploadDir(roomId), { recursive: true, force: true }).catch(() => {});
  res.json({ ok: true });
});

router.post('/:id/join', async (req, res) => {
  const roomId = Number(req.params.id);
  const room = await one('SELECT * FROM rooms WHERE id = ?', [roomId]);
  if (!room || room.type !== 'room') throw notFound('Salon introuvable');
  if (room.is_private) throw forbidden('Ce salon est privé : une invitation est nécessaire');
  await joinRoom(roomId, req.userId);
  const [dto] = await getRoomsForUser(req.userId, roomId);
  res.json({ room: dto });
});

export async function joinRoom(roomId, userId) {
  const existing = await one('SELECT 1 AS x FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, userId]);
  if (existing) return false;
  await addMember(roomId, userId);
  const me = await one('SELECT display_name FROM users WHERE id = ?', [userId]);
  const msg = await createMessage({ roomId, type: 'system', content: `${me.display_name} a rejoint le salon` });
  getIo()?.to(roomChannel(roomId)).emit('message:new', msg);
  return true;
}

router.post('/:id/leave', async (req, res) => {
  const roomId = Number(req.params.id);
  const { membership, room } = await requireMember(roomId, req.userId);
  if (room.type === 'dm') throw badRequest('Impossible de quitter un message privé');
  if (membership.role === 'owner') {
    const next = await one(
      "SELECT user_id FROM room_members WHERE room_id = ? AND user_id <> ? ORDER BY FIELD(role,'admin','member'), joined_at LIMIT 1",
      [roomId, req.userId],
    );
    if (next) {
      await query("UPDATE room_members SET role = 'owner' WHERE room_id = ? AND user_id = ?", [roomId, next.user_id]);
      await query('UPDATE rooms SET owner_id = ? WHERE id = ?', [next.user_id, roomId]);
    }
  }
  await removeMember(roomId, req.userId);
  const left = await one('SELECT COUNT(*) AS n FROM room_members WHERE room_id = ?', [roomId]);
  if (!left.n) {
    forgetBoard(roomId);
    await query('DELETE FROM rooms WHERE id = ?', [roomId]);
  } else {
    const me = await one('SELECT display_name FROM users WHERE id = ?', [req.userId]);
    const msg = await createMessage({ roomId, type: 'system', content: `${me.display_name} a quitté le salon` });
    getIo()?.to(roomChannel(roomId)).emit('message:new', msg);
  }
  res.json({ ok: true });
});

router.patch('/:id/members/:userId', async (req, res) => {
  const roomId = Number(req.params.id);
  const targetId = Number(req.params.userId);
  const { membership } = await requireMember(roomId, req.userId);
  if (membership.role !== 'owner') throw forbidden('Seul le propriétaire peut changer les rôles');
  const { role } = parse(z.object({ role: z.enum(['admin', 'member']) }), req.body);
  if (targetId === req.userId) throw badRequest('Vous ne pouvez pas changer votre propre rôle');
  await query('UPDATE room_members SET role = ? WHERE room_id = ? AND user_id = ?', [role, roomId, targetId]);
  getIo()?.to(roomChannel(roomId)).emit('room:members-changed', { roomId });
  res.json({ ok: true });
});

router.delete('/:id/members/:userId', async (req, res) => {
  const roomId = Number(req.params.id);
  const targetId = Number(req.params.userId);
  const { membership } = await requireAdmin(roomId, req.userId);
  const target = await one('SELECT role FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, targetId]);
  if (!target) throw notFound('Membre introuvable');
  if (target.role === 'owner' || (target.role === 'admin' && membership.role !== 'owner')) {
    throw forbidden('Vous ne pouvez pas exclure ce membre');
  }
  await removeMember(roomId, targetId);
  const u = await one('SELECT display_name FROM users WHERE id = ?', [targetId]);
  const msg = await createMessage({ roomId, type: 'system', content: `${u.display_name} a été retiré du salon` });
  getIo()?.to(roomChannel(roomId)).emit('message:new', msg);
  res.json({ ok: true });
});

router.patch('/:id/prefs', async (req, res) => {
  const roomId = Number(req.params.id);
  await requireMember(roomId, req.userId);
  const { starred } = parse(z.object({ starred: z.boolean() }), req.body);
  await query('UPDATE room_members SET starred = ? WHERE room_id = ? AND user_id = ?', [starred ? 1 : 0, roomId, req.userId]);
  res.json({ ok: true });
});

/* ---------- Messages, fichiers & export ---------- */

router.get('/:id/messages', async (req, res) => {
  const roomId = Number(req.params.id);
  await requireMember(roomId, req.userId);
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const before = Number(req.query.before) || null;
  const messages = await listMessages(roomId, { before, limit });
  res.json({ messages, hasMore: messages.length === limit });
});

async function memberGuard(req, _res, next) {
  try {
    await requireMember(Number(req.params.id), req.userId);
    next();
  } catch (err) {
    next(err);
  }
}

const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = roomUploadDir(Number(req.params.id));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8);
      cb(null, `${nanoid(20)}${ext}`);
    },
  }),
  limits: { fileSize: config.maxUploadBytes },
});

router.post('/:id/attachments', memberGuard, attachmentUpload.single('file'), (req, res) => {
  if (!req.file) throw badRequest('Aucun fichier reçu');
  const mime = req.file.mimetype;
  const kind = mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : mime.startsWith('video/') ? 'video' : 'file';
  res.status(201).json({
    attachment: {
      url: `/api/rooms/${req.params.id}/files/${req.file.filename}`,
      name: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
      size: req.file.size,
      mime,
      kind,
    },
  });
});

router.get('/:id/files', memberGuard, async (req, res) => {
  const rows = await query(
    `SELECT m.id, m.attachment, m.created_at, u.display_name, u.id AS uid
     FROM messages m LEFT JOIN users u ON u.id = m.user_id
     WHERE m.room_id = ? AND m.attachment IS NOT NULL AND m.deleted_at IS NULL ORDER BY m.id DESC`,
    [Number(req.params.id)],
  );
  res.json({
    files: rows.map((r) => ({ messageId: r.id, ...r.attachment, createdAt: r.created_at, author: { id: r.uid, displayName: r.display_name } })),
  });
});

router.get('/:id/files/:file', memberGuard, (req, res) => {
  const file = req.params.file;
  if (!isSafeFileName(file)) throw notFound();
  const full = path.join(roomUploadDir(Number(req.params.id)), file);
  if (!fs.existsSync(full)) throw notFound('Fichier introuvable');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  if (req.query.download) return res.download(full, String(req.query.download).slice(0, 200));
  res.sendFile(full);
});

router.get('/:id/export', async (req, res) => {
  const roomId = Number(req.params.id);
  const { room } = await requireMember(roomId, req.userId);
  const format = ['json', 'csv', 'txt', 'html', 'md'].includes(req.query.format) ? req.query.format : 'json';
  const { body, mime, filename } = await buildChatExport(room, format, req.userId);
  res.setHeader('Content-Type', `${mime}; charset=utf-8`);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
});

export default router;

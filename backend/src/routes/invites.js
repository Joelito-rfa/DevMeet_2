import { Router } from 'express';
import { customAlphabet } from 'nanoid';
import { z } from 'zod';
import { query, one } from '../db/pool.js';
import { parse, notFound, forbidden, badRequest } from '../utils/http.js';
import { requireMember } from '../services/rooms.js';
import { getRoomsForUser, joinRoom } from './rooms.js';
import { notify } from '../services/notifications.js';
import { isOnline } from '../services/presence.js';

const router = Router();
const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

function inviteDto(row) {
  return {
    code: row.code,
    roomId: row.room_id,
    createdBy: row.created_by,
    creatorName: row.display_name,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    uses: row.uses,
    revoked: !!row.revoked,
    createdAt: row.created_at,
  };
}

function isValid(inv) {
  if (!inv || inv.revoked) return false;
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) return false;
  if (inv.max_uses && inv.uses >= inv.max_uses) return false;
  return true;
}

router.post('/rooms/:id/invites', async (req, res) => {
  const roomId = Number(req.params.id);
  const { room } = await requireMember(roomId, req.userId);
  if (room.type === 'dm') throw badRequest("Impossible d'inviter dans un message privé");
  const { expiresIn, maxUses } = parse(
    z.object({
      expiresIn: z.number().int().positive().max(60 * 60 * 24 * 365).nullable().optional(),
      maxUses: z.number().int().positive().max(1000).nullable().optional(),
    }),
    req.body || {},
  );
  const code = makeCode();
  await query('INSERT INTO invites (code, room_id, created_by, expires_at, max_uses) VALUES (?,?,?,?,?)', [
    code,
    roomId,
    req.userId,
    expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    maxUses || null,
  ]);
  const row = await one('SELECT i.*, u.display_name FROM invites i LEFT JOIN users u ON u.id = i.created_by WHERE code = ?', [code]);
  res.status(201).json({ invite: inviteDto(row) });
});

router.get('/rooms/:id/invites', async (req, res) => {
  const roomId = Number(req.params.id);
  await requireMember(roomId, req.userId);
  const rows = await query(
    `SELECT i.*, u.display_name FROM invites i LEFT JOIN users u ON u.id = i.created_by
     WHERE i.room_id = ? AND i.revoked = 0 ORDER BY i.created_at DESC`,
    [roomId],
  );
  res.json({ invites: rows.filter(isValid).map(inviteDto) });
});

router.delete('/invites/:code', async (req, res) => {
  const inv = await one('SELECT * FROM invites WHERE code = ?', [req.params.code.toUpperCase()]);
  if (!inv) throw notFound('Invitation introuvable');
  const { membership } = await requireMember(inv.room_id, req.userId);
  if (inv.created_by !== req.userId && !['owner', 'admin'].includes(membership.role)) throw forbidden();
  await query('UPDATE invites SET revoked = 1 WHERE code = ?', [inv.code]);
  res.json({ ok: true });
});

router.get('/invites/:code', async (req, res) => {
  const inv = await one(
    `SELECT i.*, u.display_name, u.avatar_url, u.accent_color, u.username
     FROM invites i LEFT JOIN users u ON u.id = i.created_by WHERE i.code = ?`,
    [req.params.code.toUpperCase()],
  );
  if (!inv) throw notFound('Invitation introuvable');
  const room = await one('SELECT * FROM rooms WHERE id = ?', [inv.room_id]);
  const members = await query('SELECT user_id FROM room_members WHERE room_id = ?', [inv.room_id]);
  res.json({
    invite: {
      code: inv.code,
      valid: isValid(inv),
      expiresAt: inv.expires_at,
      inviter: inv.created_by
        ? { id: inv.created_by, displayName: inv.display_name, avatarUrl: inv.avatar_url, accentColor: inv.accent_color, username: inv.username }
        : null,
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        icon: room.icon,
        color: room.color,
        category: room.category,
        memberCount: members.length,
        onlineCount: members.filter((m) => isOnline(m.user_id)).length,
      },
      alreadyMember: members.some((m) => m.user_id === req.userId),
    },
  });
});

router.post('/invites/:code/accept', async (req, res) => {
  const inv = await one('SELECT * FROM invites WHERE code = ?', [req.params.code.toUpperCase()]);
  if (!inv) throw notFound('Invitation introuvable');
  const already = await one('SELECT 1 AS x FROM room_members WHERE room_id = ? AND user_id = ?', [inv.room_id, req.userId]);
  if (!already) {
    if (!isValid(inv)) throw badRequest('Cette invitation a expiré ou a été révoquée');
    await query('UPDATE invites SET uses = uses + 1 WHERE code = ?', [inv.code]);
    await joinRoom(inv.room_id, req.userId);
    if (inv.created_by && inv.created_by !== req.userId) {
      const me = await one('SELECT display_name FROM users WHERE id = ?', [req.userId]);
      await notify({
        userId: inv.created_by,
        type: 'invite_accepted',
        roomId: inv.room_id,
        actorId: req.userId,
        content: `${me.display_name} a rejoint le salon grâce à votre invitation`,
      });
    }
  }
  const [room] = await getRoomsForUser(req.userId, inv.room_id);
  res.json({ room });
});

export default router;

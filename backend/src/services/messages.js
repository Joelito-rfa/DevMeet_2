import fs from 'node:fs';
import path from 'node:path';
import { query, one } from '../db/pool.js';
import { config } from '../config.js';

export const MESSAGE_SELECT = `
  SELECT m.*, u.username, u.display_name, u.avatar_url, u.accent_color
  FROM messages m LEFT JOIN users u ON u.id = m.user_id`;

function toDto(row, reactions, replies) {
  const deleted = !!row.deleted_at;
  const reply = row.reply_to_id ? replies.get(row.reply_to_id) : null;
  return {
    id: row.id,
    roomId: row.room_id,
    type: row.type,
    content: deleted ? '' : row.content,
    attachment: deleted ? null : row.attachment || null,
    replyTo: reply || null,
    author: row.user_id
      ? {
          id: row.user_id,
          username: row.username,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
          accentColor: row.accent_color,
        }
      : null,
    reactions: reactions.get(row.id) || [],
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
  };
}

export async function hydrateMessages(rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const reactionRows = await query(
    'SELECT message_id, icon, user_id FROM message_reactions WHERE message_id IN (?) ORDER BY created_at',
    [ids],
  );
  const reactions = new Map();
  for (const r of reactionRows) {
    const list = reactions.get(r.message_id) || [];
    let entry = list.find((e) => e.icon === r.icon);
    if (!entry) list.push((entry = { icon: r.icon, userIds: [] }));
    entry.userIds.push(r.user_id);
    reactions.set(r.message_id, list);
  }
  const replyIds = [...new Set(rows.map((r) => r.reply_to_id).filter(Boolean))];
  const replies = new Map();
  if (replyIds.length) {
    const replyRows = await query(
      `SELECT m.id, m.content, m.deleted_at, m.attachment, u.display_name, u.id AS uid
       FROM messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.id IN (?)`,
      [replyIds],
    );
    for (const r of replyRows) {
      replies.set(r.id, {
        id: r.id,
        content: r.deleted_at ? 'Message supprimé' : r.content || (r.attachment ? `Pièce jointe : ${r.attachment.name}` : ''),
        authorName: r.display_name || 'Utilisateur supprimé',
        authorId: r.uid,
      });
    }
  }
  return rows.map((r) => toDto(r, reactions, replies));
}

export async function getMessage(id) {
  const row = await one(`${MESSAGE_SELECT} WHERE m.id = ?`, [id]);
  if (!row) return null;
  const [msg] = await hydrateMessages([row]);
  return msg;
}

export async function listMessages(roomId, { before, limit = 50 } = {}) {
  const params = [roomId];
  let where = 'm.room_id = ?';
  if (before) {
    where += ' AND m.id < ?';
    params.push(before);
  }
  params.push(limit);
  const rows = await query(`${MESSAGE_SELECT} WHERE ${where} ORDER BY m.id DESC LIMIT ?`, params);
  return hydrateMessages(rows.reverse());
}

export async function createMessage({ roomId, userId = null, content, type = 'text', attachment = null, replyToId = null }) {
  const res = await query(
    'INSERT INTO messages (room_id, user_id, type, content, attachment, reply_to_id) VALUES (?,?,?,?,?,?)',
    [roomId, userId, type, content, attachment ? JSON.stringify(attachment) : null, replyToId],
  );
  return getMessage(res.insertId);
}

const SAFE_FILE = /^[A-Za-z0-9_-]{8,40}(\.[A-Za-z0-9]{1,8})?$/;

export function roomUploadDir(roomId) {
  return path.join(config.uploadDir, 'rooms', String(roomId));
}

/** Vérifie qu'une pièce jointe référence bien un fichier téléversé dans ce salon. */
export function validateAttachment(roomId, attachment) {
  if (!attachment) return null;
  const prefix = `/api/rooms/${roomId}/files/`;
  if (typeof attachment.url !== 'string' || !attachment.url.startsWith(prefix)) return null;
  const file = attachment.url.slice(prefix.length);
  if (!SAFE_FILE.test(file) || !fs.existsSync(path.join(roomUploadDir(roomId), file))) return null;
  const kinds = ['image', 'audio', 'video', 'file'];
  return {
    url: attachment.url,
    name: String(attachment.name || file).slice(0, 200),
    size: Number(attachment.size) || 0,
    mime: String(attachment.mime || 'application/octet-stream').slice(0, 100),
    kind: kinds.includes(attachment.kind) ? attachment.kind : 'file',
    duration: attachment.duration ? Number(attachment.duration) : undefined,
    width: attachment.width ? Number(attachment.width) : undefined,
    height: attachment.height ? Number(attachment.height) : undefined,
  };
}

export const isSafeFileName = (name) => SAFE_FILE.test(name);

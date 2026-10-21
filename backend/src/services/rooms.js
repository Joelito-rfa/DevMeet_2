import { one, query } from '../db/pool.js';
import { forbidden, notFound } from '../utils/http.js';
import { getIo, roomChannel, userChannel } from '../socket/io.js';

export async function getMembership(roomId, userId) {
  return one('SELECT * FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, userId]);
}

export async function requireMember(roomId, userId) {
  const room = await one('SELECT * FROM rooms WHERE id = ?', [roomId]);
  if (!room) throw notFound('Salon introuvable');
  const membership = await getMembership(roomId, userId);
  if (!membership) throw forbidden("Vous n'êtes pas membre de ce salon");
  return { room, membership };
}

export async function requireAdmin(roomId, userId) {
  const ctx = await requireMember(roomId, userId);
  if (!['owner', 'admin'].includes(ctx.membership.role)) {
    throw forbidden('Action réservée aux administrateurs du salon');
  }
  return ctx;
}

/** Ajoute un membre, abonne ses sockets au canal du salon et prévient les autres. */
export async function addMember(roomId, userId, role = 'member') {
  const lastId = await one('SELECT COALESCE(MAX(id),0) AS id FROM messages WHERE room_id = ?', [roomId]);
  await query(
    `INSERT IGNORE INTO room_members (room_id, user_id, role, last_read_message_id, last_delivered_message_id)
     VALUES (?, ?, ?, ?, ?)`,
    [roomId, userId, role, lastId.id, lastId.id],
  );
  const io = getIo();
  if (io) {
    io.in(userChannel(userId)).socketsJoin(roomChannel(roomId));
    io.to(roomChannel(roomId)).emit('room:members-changed', { roomId });
  }
}

export async function removeMember(roomId, userId) {
  await query('DELETE FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, userId]);
  const io = getIo();
  if (io) {
    io.in(userChannel(userId)).socketsLeave([roomChannel(roomId), `board:${roomId}`]);
    io.to(userChannel(userId)).emit('room:removed', { roomId });
    io.to(roomChannel(roomId)).emit('room:members-changed', { roomId });
  }
}

export async function getMemberIds(roomId) {
  const rows = await query('SELECT user_id FROM room_members WHERE room_id = ?', [roomId]);
  return rows.map((r) => r.user_id);
}

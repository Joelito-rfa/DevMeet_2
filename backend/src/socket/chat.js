import { query, one } from '../db/pool.js';
import { createMessage, getMessage, validateAttachment } from '../services/messages.js';
import { notify } from '../services/notifications.js';
import { publicPresence } from '../services/presence.js';
import { roomChannel } from './io.js';

const MAX_LEN = 4000;
/** Nom d'icône UI (lucide) au format kebab-case, ex. « thumbs-up ». */
const ICON_NAME_RE = /^[a-z][a-z0-9-]{0,30}$/;

export function registerChat(io, socket) {
  const userId = socket.data.userId;
  const inRoom = (roomId) => socket.rooms.has(roomChannel(roomId));

  async function emitReceipt(roomId) {
    const row = await one(
      'SELECT last_read_message_id, last_delivered_message_id FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, userId],
    );
    if (!row) return;
    io.to(roomChannel(roomId)).emit('receipt:update', {
      roomId,
      userId,
      lastReadMessageId: Number(row.last_read_message_id),
      lastDeliveredMessageId: Number(row.last_delivered_message_id),
    });
  }

  socket.on('message:send', async (payload, ack = () => {}) => {
    try {
      const roomId = Number(payload?.roomId);
      if (!inRoom(roomId)) return ack({ error: 'Accès refusé' });
      const content = String(payload.content || '').trim().slice(0, MAX_LEN);
      const attachment = validateAttachment(roomId, payload.attachment);
      if (!content && !attachment) return ack({ error: 'Message vide' });
      let replyToId = Number(payload.replyToId) || null;
      if (replyToId) {
        const parent = await one('SELECT id FROM messages WHERE id = ? AND room_id = ?', [replyToId, roomId]);
        if (!parent) replyToId = null;
      }
      const message = await createMessage({ roomId, userId, content, attachment, replyToId });
      await query(
        `UPDATE room_members SET last_read_message_id = GREATEST(last_read_message_id, ?),
           last_delivered_message_id = GREATEST(last_delivered_message_id, ?) WHERE room_id = ? AND user_id = ?`,
        [message.id, message.id, roomId, userId],
      );
      io.to(roomChannel(roomId)).emit('message:new', { ...message, clientId: payload.clientId });
      ack({ ok: true, message });
      emitReceipt(roomId);
      notifyRecipients(roomId, message).catch(console.error);
    } catch (err) {
      console.error(err);
      ack({ error: "Échec de l'envoi" });
    }
  });

  async function notifyRecipients(roomId, message) {
    const room = await one('SELECT type, name FROM rooms WHERE id = ?', [roomId]);
    const preview = message.content || (message.attachment ? `Pièce jointe : ${message.attachment.name}` : '');
    const notViewing = (uid) => publicPresence(uid).roomId !== roomId;
    if (room.type === 'dm') {
      const peer = await one('SELECT user_id FROM room_members WHERE room_id = ? AND user_id <> ?', [roomId, userId]);
      if (peer && notViewing(peer.user_id)) {
        await notify({ userId: peer.user_id, type: 'dm', roomId, actorId: userId, messageId: message.id, content: preview });
      }
      return;
    }
    const names = [...new Set([...(message.content || '').matchAll(/@([a-z0-9_.]{3,32})/gi)].map((m) => m[1].toLowerCase()))];
    if (!names.length) return;
    const everyone = names.includes('tous') || names.includes('everyone');
    const targets = everyone
      ? await query('SELECT user_id AS id FROM room_members WHERE room_id = ? AND user_id <> ?', [roomId, userId])
      : await query(
          'SELECT u.id FROM users u JOIN room_members rm ON rm.user_id = u.id AND rm.room_id = ? WHERE u.username IN (?) AND u.id <> ?',
          [roomId, names, userId],
        );
    for (const t of targets) {
      if (notViewing(t.id)) {
        await notify({ userId: t.id, type: 'mention', roomId, actorId: userId, messageId: message.id, content: preview });
      }
    }
  }

  socket.on('message:edit', async ({ id, content } = {}, ack = () => {}) => {
    const msg = await one('SELECT * FROM messages WHERE id = ?', [Number(id)]);
    if (!msg || msg.user_id !== userId || msg.deleted_at || !inRoom(msg.room_id)) return ack({ error: 'Action impossible' });
    const text = String(content || '').trim().slice(0, MAX_LEN);
    if (!text && !msg.attachment) return ack({ error: 'Message vide' });
    await query('UPDATE messages SET content = ?, edited_at = NOW() WHERE id = ?', [text, msg.id]);
    const updated = await getMessage(msg.id);
    io.to(roomChannel(msg.room_id)).emit('message:updated', updated);
    ack({ ok: true });
  });

  socket.on('message:delete', async ({ id } = {}, ack = () => {}) => {
    const msg = await one('SELECT * FROM messages WHERE id = ?', [Number(id)]);
    if (!msg || !inRoom(msg.room_id)) return ack({ error: 'Action impossible' });
    if (msg.user_id !== userId) {
      const m = await one('SELECT role FROM room_members WHERE room_id = ? AND user_id = ?', [msg.room_id, userId]);
      if (!m || !['owner', 'admin'].includes(m.role)) return ack({ error: 'Action impossible' });
    }
    await query('UPDATE messages SET deleted_at = NOW() WHERE id = ?', [msg.id]);
    io.to(roomChannel(msg.room_id)).emit('message:updated', await getMessage(msg.id));
    ack({ ok: true });
  });

  socket.on('message:react', async ({ id, icon } = {}, ack = () => {}) => {
    const messageId = Number(id) || 0;
    if (!messageId || typeof icon !== 'string' || !ICON_NAME_RE.test(icon)) return ack({ error: 'Réaction invalide' });
    const msg = await one('SELECT id, room_id FROM messages WHERE id = ? AND deleted_at IS NULL', [messageId]);
    if (!msg || !inRoom(msg.room_id)) return ack({ error: 'Réaction invalide' });
    const existing = await one('SELECT 1 AS x FROM message_reactions WHERE message_id = ? AND user_id = ? AND icon = ?', [msg.id, userId, icon]);
    if (existing) await query('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND icon = ?', [msg.id, userId, icon]);
    else await query('INSERT INTO message_reactions (message_id, user_id, icon) VALUES (?,?,?)', [msg.id, userId, icon]);
    const updated = await getMessage(msg.id);
    io.to(roomChannel(msg.room_id)).emit('message:reactions', { id: msg.id, roomId: msg.room_id, reactions: updated.reactions });
    ack({ ok: true });
  });

  socket.on('message:ack', async ({ roomId, messageId, kind } = {}) => {
    roomId = Number(roomId);
    messageId = Number(messageId);
    if (!inRoom(roomId) || !messageId) return;
    const sets =
      kind === 'read'
        ? 'last_read_message_id = GREATEST(last_read_message_id, ?), last_delivered_message_id = GREATEST(last_delivered_message_id, ?)'
        : 'last_delivered_message_id = GREATEST(last_delivered_message_id, ?)';
    const params = kind === 'read' ? [messageId, messageId] : [messageId];
    const res = await query(`UPDATE room_members SET ${sets} WHERE room_id = ? AND user_id = ?`, [...params, roomId, userId]);
    if (res.changedRows) emitReceipt(roomId);
  });

  socket.on('typing', ({ roomId, isTyping } = {}) => {
    roomId = Number(roomId);
    if (!inRoom(roomId)) return;
    socket.to(roomChannel(roomId)).emit('typing', { roomId, userId, isTyping: !!isTyping });
  });
}

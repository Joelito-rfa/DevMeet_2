import { query, one } from '../db/pool.js';
import { getIo, userChannel } from '../socket/io.js';

export async function notify({ userId, type, roomId = null, actorId = null, messageId = null, content = null }) {
  const res = await query(
    'INSERT INTO notifications (user_id, type, room_id, actor_id, message_id, content) VALUES (?,?,?,?,?,?)',
    [userId, type, roomId, actorId, messageId, content?.slice(0, 255) ?? null],
  );
  const notification = await getNotification(res.insertId);
  getIo()?.to(userChannel(userId)).emit('notification:new', notification);
  return notification;
}

export const NOTIFICATION_SELECT = `
  SELECT n.*, u.id AS a_id, u.username AS a_username, u.display_name AS a_display_name,
         u.avatar_url AS a_avatar_url, u.accent_color AS a_accent_color,
         r.name AS room_name, r.type AS room_type, r.icon AS room_icon, r.color AS room_color
  FROM notifications n
  LEFT JOIN users u ON u.id = n.actor_id
  LEFT JOIN rooms r ON r.id = n.room_id`;

export function notificationDto(row) {
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    roomId: row.room_id,
    messageId: row.message_id,
    room: row.room_id ? { id: row.room_id, name: row.room_name, type: row.room_type, icon: row.room_icon, color: row.room_color } : null,
    actor: row.a_id
      ? { id: row.a_id, username: row.a_username, displayName: row.a_display_name, avatarUrl: row.a_avatar_url, accentColor: row.a_accent_color }
      : null,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

async function getNotification(id) {
  const row = await one(`${NOTIFICATION_SELECT} WHERE n.id = ?`, [id]);
  return row ? notificationDto(row) : null;
}

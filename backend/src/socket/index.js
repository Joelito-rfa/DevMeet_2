import { Server } from 'socket.io';
import { parseCookie } from 'cookie';
import { config } from '../config.js';
import { query, one } from '../db/pool.js';
import { verifyToken } from '../middleware/auth.js';
import * as presence from '../services/presence.js';
import { setIo, roomChannel, userChannel } from './io.js';
import { registerChat } from './chat.js';
import { registerBoard } from './board.js';
import { registerVoice, voiceSnapshotFor } from './voice.js';

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientUrl, credentials: true },
    maxHttpBufferSize: 2e6,
    pingInterval: 10000,
    pingTimeout: 8000,
    connectionStateRecovery: { maxDisconnectionDuration: 60 * 1000 },
  });
  setIo(io);

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie || '');
      const userId = verifyToken(cookies[config.cookieName]);
      if (!userId) return next(new Error('unauthorized'));
      const user = await one('SELECT id, preferred_status, custom_status FROM users WHERE id = ?', [userId]);
      if (!user) return next(new Error('unauthorized'));
      socket.data.userId = userId;
      socket.data.user = user;
      next();
    } catch (err) {
      console.error('[socket] auth', err);
      next(new Error('server_error'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    socket.join(userChannel(userId));
    const memberships = await query('SELECT room_id FROM room_members WHERE user_id = ?', [userId]).catch(() => []);
    socket.join(memberships.map((m) => roomChannel(m.room_id)));

    presence.connect(socket, socket.data.user);
    socket.emit('presence:snapshot', presence.snapshot());
    socket.emit('voice:snapshot', voiceSnapshotFor(socket));

    registerChat(io, socket);
    registerBoard(io, socket);
    registerVoice(io, socket);

    socket.on('presence:activity', ({ state } = {}) => presence.setActivity(userId, state === 'idle' ? 'idle' : 'active'));
    socket.on('presence:room', ({ roomId } = {}) => {
      const rid = Number(roomId) || null;
      presence.setRoom(userId, rid && socket.rooms.has(roomChannel(rid)) ? rid : null);
    });
    socket.on('voice:snapshot', (ack = () => {}) => ack(voiceSnapshotFor(socket)));

    socket.on('disconnect', () => presence.disconnect(socket));
  });

  return io;
}

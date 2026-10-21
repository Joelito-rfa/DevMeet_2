import { one } from '../db/pool.js';
import { loadBoard, elementsOf, applyOps, setLocked } from '../services/boardStore.js';
import { roomChannel, boardChannel } from './io.js';

export function registerBoard(io, socket) {
  const userId = socket.data.userId;
  const isAdmin = async (roomId) => {
    const m = await one('SELECT role FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, userId]);
    return !!m && ['owner', 'admin'].includes(m.role);
  };

  socket.on('board:join', async ({ roomId } = {}, ack = () => {}) => {
    roomId = Number(roomId);
    if (!socket.rooms.has(roomChannel(roomId))) return ack({ error: 'Accès refusé' });
    socket.join(boardChannel(roomId));
    const board = await loadBoard(roomId);
    ack({ elements: elementsOf(board), locked: board.locked });
  });

  socket.on('board:leave', ({ roomId } = {}) => {
    roomId = Number(roomId);
    socket.leave(boardChannel(roomId));
    socket.to(boardChannel(roomId)).emit('board:cursor-leave', { roomId, userId });
  });

  socket.on('board:op', async ({ roomId, ops } = {}, ack = () => {}) => {
    roomId = Number(roomId);
    if (!socket.rooms.has(boardChannel(roomId))) return ack({ error: 'Accès refusé' });
    const board = await loadBoard(roomId);
    if (board.locked && !(await isAdmin(roomId))) return ack({ error: 'Le tableau est verrouillé' });
    const applied = applyOps(board, ops, userId);
    if (applied.length) socket.to(boardChannel(roomId)).emit('board:op', { roomId, ops: applied, userId });
    ack({ ok: true });
  });

  socket.on('board:cursor', ({ roomId, x, y } = {}) => {
    roomId = Number(roomId);
    if (!socket.rooms.has(boardChannel(roomId)) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    socket.volatile.to(boardChannel(roomId)).emit('board:cursor', { roomId, userId, x, y });
  });

  socket.on('board:lock', async ({ roomId, locked } = {}, ack = () => {}) => {
    roomId = Number(roomId);
    if (!socket.rooms.has(boardChannel(roomId)) || !(await isAdmin(roomId))) {
      return ack({ error: 'Seuls les administrateurs peuvent verrouiller le tableau' });
    }
    const board = await loadBoard(roomId);
    await setLocked(board, !!locked, userId);
    io.to(boardChannel(roomId)).emit('board:locked', { roomId, locked: !!locked, by: userId });
    ack({ ok: true });
  });

  socket.on('disconnecting', () => {
    for (const ch of socket.rooms) {
      if (ch.startsWith('board:')) {
        socket.to(ch).emit('board:cursor-leave', { roomId: Number(ch.slice(6)), userId });
      }
    }
  });
}

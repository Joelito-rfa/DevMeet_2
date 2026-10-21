import { roomChannel, voiceChannel } from './io.js';

/** Salons vocaux : signalisation WebRTC en maillage (mesh) via Socket.io. */
const voiceRooms = new Map(); // roomId -> Map<socketId, { userId, muted, deafened, video, screen }>

export function voiceState(roomId) {
  const peers = voiceRooms.get(roomId);
  return peers ? [...peers.entries()].map(([socketId, p]) => ({ socketId, ...p })) : [];
}

export function voiceSnapshotFor(socket) {
  const list = [];
  for (const [roomId] of voiceRooms) {
    if (socket.rooms.has(roomChannel(roomId))) list.push({ roomId, participants: voiceState(roomId) });
  }
  return list;
}

export function registerVoice(io, socket) {
  const userId = socket.data.userId;
  const broadcast = (roomId) => io.to(roomChannel(roomId)).emit('voice:update', { roomId, participants: voiceState(roomId) });

  function leave() {
    const roomId = socket.data.voiceRoomId;
    if (!roomId) return;
    socket.data.voiceRoomId = null;
    const peers = voiceRooms.get(roomId);
    peers?.delete(socket.id);
    if (peers && !peers.size) voiceRooms.delete(roomId);
    socket.leave(voiceChannel(roomId));
    io.to(voiceChannel(roomId)).emit('voice:peer-left', { roomId, socketId: socket.id });
    broadcast(roomId);
  }

  socket.on('voice:join', ({ roomId, muted = false } = {}, ack = () => {}) => {
    roomId = Number(roomId);
    if (!socket.rooms.has(roomChannel(roomId))) return ack({ error: 'Accès refusé' });
    leave();
    // Un même utilisateur ne peut être que dans un seul vocal : on ferme ses autres sessions.
    for (const [rid, peers] of voiceRooms) {
      for (const [sid, p] of peers) {
        if (p.userId === userId) io.to(sid).emit('voice:kicked', { roomId: rid, reason: 'Connecté depuis un autre onglet' });
      }
    }
    if (!voiceRooms.has(roomId)) voiceRooms.set(roomId, new Map());
    const existing = voiceState(roomId);
    voiceRooms.get(roomId).set(socket.id, { userId, muted: !!muted, deafened: false, video: false, screen: false });
    socket.data.voiceRoomId = roomId;
    socket.join(voiceChannel(roomId));
    ack({ ok: true, peers: existing });
    broadcast(roomId);
  });

  socket.on('voice:leave', () => leave());

  socket.on('voice:signal', ({ to, data } = {}) => {
    const roomId = socket.data.voiceRoomId;
    if (!roomId || !voiceRooms.get(roomId)?.has(to)) return;
    io.to(to).emit('voice:signal', { from: socket.id, userId, data });
  });

  socket.on('voice:state', (state = {}) => {
    const roomId = socket.data.voiceRoomId;
    const me = roomId && voiceRooms.get(roomId)?.get(socket.id);
    if (!me) return;
    for (const k of ['muted', 'deafened', 'video', 'screen']) if (k in state) me[k] = !!state[k];
    broadcast(roomId);
  });

  socket.on('disconnect', leave);
  return { leave };
}

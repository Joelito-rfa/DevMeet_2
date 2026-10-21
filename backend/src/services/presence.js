import { query } from '../db/pool.js';
import { getIo } from '../socket/io.js';

/**
 * Présence en mémoire.
 * Un utilisateur peut avoir plusieurs sockets (onglets) : il est hors ligne
 * quand son dernier socket se ferme (après une courte période de grâce pour
 * absorber un simple rafraîchissement de page).
 */
const sockets = new Map(); // userId -> Set<socketId>
const state = new Map(); // userId -> { preferred, auto, customStatus, roomId }
const offlineTimers = new Map();
const GRACE_MS = 2500;

function effectiveStatus(s) {
  if (s.preferred === 'online' && s.auto === 'idle') return 'idle';
  return s.preferred;
}

export function publicPresence(userId) {
  const s = state.get(userId);
  const connected = sockets.get(userId)?.size > 0;
  if (!s || !connected || s.preferred === 'invisible') {
    return { userId, status: 'offline', roomId: null, customStatus: s?.customStatus ?? null };
  }
  return { userId, status: effectiveStatus(s), roomId: s.roomId, customStatus: s.customStatus };
}

function broadcast(userId) {
  getIo()?.emit('presence:update', publicPresence(userId));
}

export function snapshot() {
  return [...sockets.keys()].map(publicPresence).filter((p) => p.status !== 'offline');
}

export function isOnline(userId) {
  return publicPresence(userId).status !== 'offline';
}

export function connect(socket, user) {
  const userId = user.id;
  clearTimeout(offlineTimers.get(userId));
  offlineTimers.delete(userId);
  if (!sockets.has(userId)) sockets.set(userId, new Set());
  sockets.get(userId).add(socket.id);
  if (!state.has(userId)) {
    state.set(userId, { preferred: user.preferred_status, auto: 'active', customStatus: user.custom_status, roomId: null });
  }
  broadcast(userId);
}

export function disconnect(socket, onOffline) {
  const userId = socket.data.userId;
  const set = sockets.get(userId);
  if (!set) return;
  set.delete(socket.id);
  if (set.size > 0) return;
  offlineTimers.set(
    userId,
    setTimeout(async () => {
      offlineTimers.delete(userId);
      if (sockets.get(userId)?.size) return;
      sockets.delete(userId);
      broadcast(userId);
      state.delete(userId);
      onOffline?.(userId);
      await query('UPDATE users SET last_seen_at = NOW() WHERE id = ?', [userId]).catch(() => {});
    }, GRACE_MS),
  );
}

export function setPreferred(userId, preferred) {
  const s = state.get(userId);
  if (s) {
    s.preferred = preferred;
    broadcast(userId);
  }
}

export function setCustomStatus(userId, customStatus) {
  const s = state.get(userId);
  if (s) {
    s.customStatus = customStatus;
    broadcast(userId);
  }
}

export function setActivity(userId, auto) {
  const s = state.get(userId);
  if (s && s.auto !== auto) {
    s.auto = auto;
    broadcast(userId);
  }
}

export function setRoom(userId, roomId) {
  const s = state.get(userId);
  if (s && s.roomId !== roomId) {
    s.roomId = roomId;
    broadcast(userId);
  }
}

export function forget(userId) {
  sockets.delete(userId);
  state.delete(userId);
  getIo()?.emit('presence:update', { userId, status: 'offline', roomId: null });
}

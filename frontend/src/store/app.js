import { create } from 'zustand';
import { api } from '../lib/api';

const initial = {
  rooms: [],
  roomsLoaded: false,
  users: {},
  presence: {},
  voice: {},
  typing: {},
  details: {},
  notifications: [],
  connection: 'connecting',
  activeRoomId: null,
};

export const useApp = create((set, get) => ({
  ...initial,
  reset: () => set({ ...initial }),

  setConnection: (connection) => set({ connection }),
  setActiveRoom: (activeRoomId) => set({ activeRoomId }),

  mergeUsers(list) {
    const users = { ...get().users };
    for (const u of list) if (u?.id) users[u.id] = { ...users[u.id], ...u };
    set({ users });
  },

  async loadRooms() {
    const { rooms, users = [] } = await api.get('/rooms');
    get().mergeUsers([...users, ...rooms.map((r) => r.peer).filter(Boolean)]);
    set({ rooms, roomsLoaded: true });
    return rooms;
  },

  async refreshRoom(roomId) {
    try {
      const { room, members } = await api.get(`/rooms/${roomId}`);
      get().upsertRoom(room);
      get().setDetails(roomId, members);
      return room;
    } catch {
      return null;
    }
  },

  upsertRoom(room) {
    const rooms = get().rooms;
    const idx = rooms.findIndex((r) => r.id === room.id);
    if (room.peer) get().mergeUsers([room.peer]);
    set({ rooms: idx === -1 ? [...rooms, room] : rooms.map((r) => (r.id === room.id ? { ...r, ...room } : r)) });
  },

  patchRoom(roomId, patch) {
    set({ rooms: get().rooms.map((r) => (r.id === roomId ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } : r)) });
  },

  removeRoom(roomId) {
    const details = { ...get().details };
    delete details[roomId];
    set({ rooms: get().rooms.filter((r) => r.id !== roomId), details });
  },

  setDetails(roomId, members) {
    get().mergeUsers(members);
    const receipts = {};
    for (const m of members) {
      receipts[m.id] = { lastReadMessageId: m.lastReadMessageId, lastDeliveredMessageId: m.lastDeliveredMessageId };
    }
    set({ details: { ...get().details, [roomId]: { members, receipts } } });
  },

  setReceipt({ roomId, userId, lastReadMessageId, lastDeliveredMessageId }) {
    const d = get().details[roomId];
    if (!d) return;
    set({
      details: {
        ...get().details,
        [roomId]: { ...d, receipts: { ...d.receipts, [userId]: { lastReadMessageId, lastDeliveredMessageId } } },
      },
    });
  },

  setPresenceSnapshot(list) {
    const presence = {};
    for (const p of list) presence[p.userId] = p;
    set({ presence });
  },

  setPresence(p) {
    set({ presence: { ...get().presence, [p.userId]: p } });
  },

  setVoice(roomId, participants) {
    const voice = { ...get().voice };
    if (participants.length) voice[roomId] = participants;
    else delete voice[roomId];
    set({ voice });
  },

  setTyping(roomId, userId, isTyping) {
    const roomTyping = { ...(get().typing[roomId] || {}) };
    if (isTyping) roomTyping[userId] = Date.now();
    else delete roomTyping[userId];
    set({ typing: { ...get().typing, [roomId]: roomTyping } });
  },

  pruneTyping() {
    const now = Date.now();
    let changed = false;
    const typing = {};
    for (const [rid, map] of Object.entries(get().typing)) {
      typing[rid] = {};
      for (const [uid, t] of Object.entries(map)) {
        if (now - t < 6000) typing[rid][uid] = t;
        else changed = true;
      }
    }
    if (changed) set({ typing });
  },

  async loadNotifications() {
    const { notifications } = await api.get('/notifications');
    set({ notifications });
  },
  addNotification(n) {
    set({ notifications: [n, ...get().notifications].slice(0, 100) });
  },
  async markAllNotificationsRead() {
    set({ notifications: get().notifications.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })) });
    await api.post('/notifications/read-all').catch(() => {});
  },
  async markNotificationRead(id) {
    set({ notifications: get().notifications.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) });
    await api.post(`/notifications/${id}/read`).catch(() => {});
  },
  async clearNotifications() {
    set({ notifications: [] });
    await api.del('/notifications').catch(() => {});
  },
}));

/** Statut public d'un utilisateur (le sien est affiché selon sa préférence). */
export function usePresence(userId) {
  return useApp((s) => s.presence[userId]) || { userId, status: 'offline', roomId: null };
}

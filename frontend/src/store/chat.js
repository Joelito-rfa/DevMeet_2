import { create } from 'zustand';
import { api } from '../lib/api';

const empty = { items: [], hasMore: true, loaded: false, loading: false };

export const useChat = create((set, get) => ({
  rooms: {},
  replyTo: {},
  editing: null,

  reset: () => set({ rooms: {}, replyTo: {}, editing: null }),

  room: (roomId) => get().rooms[roomId] || empty,

  _set(roomId, patch) {
    const cur = get().rooms[roomId] || empty;
    set({ rooms: { ...get().rooms, [roomId]: { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) } } });
  },

  async load(roomId, { force = false } = {}) {
    const cur = get().room(roomId);
    if ((cur.loaded && !force) || cur.loading) return;
    get()._set(roomId, { loading: true });
    try {
      const { messages, hasMore } = await api.get(`/rooms/${roomId}/messages?limit=50`);
      get()._set(roomId, (c) => {
        // Conserve les messages en attente d'envoi lors d'un rechargement.
        const pending = c.items.filter((m) => !m.id);
        return { items: [...messages, ...pending], hasMore, loaded: true, loading: false };
      });
    } catch (e) {
      get()._set(roomId, { loading: false });
      throw e;
    }
  },

  async loadMore(roomId) {
    const cur = get().room(roomId);
    const oldest = cur.items.find((m) => m.id);
    if (!cur.hasMore || cur.loading || !oldest) return 0;
    get()._set(roomId, { loading: true });
    const { messages, hasMore } = await api.get(`/rooms/${roomId}/messages?limit=50&before=${oldest.id}`);
    get()._set(roomId, (c) => ({ items: [...messages, ...c.items], hasMore, loading: false }));
    return messages.length;
  },

  addPending(roomId, msg) {
    get()._set(roomId, (c) => ({ items: [...c.items, msg] }));
  },

  /** Ajoute un message reçu (ou confirme un message en attente via son clientId). */
  receive(msg) {
    const cur = get().rooms[msg.roomId];
    if (!cur?.loaded) return;
    get()._set(msg.roomId, (c) => {
      if (c.items.some((m) => m.id === msg.id)) {
        return { items: c.items.map((m) => (m.id === msg.id ? { ...m, ...msg, status: undefined } : m)) };
      }
      const idx = msg.clientId ? c.items.findIndex((m) => m.clientId === msg.clientId) : -1;
      if (idx !== -1) {
        const items = [...c.items];
        items[idx] = { ...msg, clientId: msg.clientId };
        return { items };
      }
      return { items: [...c.items, msg] };
    });
  },

  markFailed(roomId, clientId) {
    get()._set(roomId, (c) => ({ items: c.items.map((m) => (m.clientId === clientId && !m.id ? { ...m, status: 'failed' } : m)) }));
  },

  removePending(roomId, clientId) {
    get()._set(roomId, (c) => ({ items: c.items.filter((m) => !(m.clientId === clientId && !m.id)) }));
  },

  update(msg) {
    if (!get().rooms[msg.roomId]) return;
    get()._set(msg.roomId, (c) => ({ items: c.items.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)) }));
  },

  setReactions(roomId, id, reactions) {
    if (!get().rooms[roomId]) return;
    get()._set(roomId, (c) => ({ items: c.items.map((m) => (m.id === id ? { ...m, reactions } : m)) }));
  },

  setReplyTo(roomId, msg) {
    set({ replyTo: { ...get().replyTo, [roomId]: msg } });
  },
  setEditing(editing) {
    set({ editing });
  },
  forget(roomId) {
    const rooms = { ...get().rooms };
    delete rooms[roomId];
    set({ rooms });
  },
}));

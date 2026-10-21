import { create } from 'zustand';
import { api } from '../lib/api';
import { socket } from '../lib/socket';
import { useApp } from './app';
import { useChat } from './chat';

export const useAuth = create((set) => ({
  user: null,
  status: 'loading',

  async init() {
    try {
      const { user } = await api.get('/auth/me');
      set({ user, status: 'authed' });
    } catch {
      set({ user: null, status: 'guest' });
    }
  },

  async login(identifier, password) {
    const { user } = await api.post('/auth/login', { identifier, password });
    set({ user, status: 'authed' });
    return user;
  },

  async register(payload) {
    const { user } = await api.post('/auth/register', payload);
    set({ user, status: 'authed' });
    return user;
  },

  async logout() {
    await api.post('/auth/logout').catch(() => {});
    socket.disconnect();
    useApp.getState().reset();
    useChat.getState().reset();
    set({ user: null, status: 'guest' });
  },

  setUser(user) {
    set({ user });
    if (user) useApp.getState().mergeUsers([user]);
  },
}));

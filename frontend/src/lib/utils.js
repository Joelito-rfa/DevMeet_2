import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, isToday, isYesterday, formatDistanceToNowStrict, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { statusColors, statusLabels } from './tokens';

export const cn = (...args) => twMerge(clsx(...args));

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function formatTime(date) {
  return format(new Date(date), 'HH:mm');
}

export function formatDay(date) {
  const d = new Date(date);
  if (isToday(d)) return "Aujourd'hui";
  if (isYesterday(d)) return 'Hier';
  return format(d, 'EEEE d MMMM yyyy', { locale: fr });
}

export function formatShort(date) {
  const d = new Date(date);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Hier';
  return format(d, 'd MMM', { locale: fr });
}

export function formatFull(date) {
  return format(new Date(date), "d MMMM yyyy 'à' HH:mm", { locale: fr });
}

export const fromNow = (date) => formatDistanceToNowStrict(new Date(date), { locale: fr, addSuffix: true });
export const sameDay = (a, b) => isSameDay(new Date(a), new Date(b));

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 ** 2).toFixed(1)} Mo`;
}

export function formatDuration(s = 0) {
  s = Math.max(0, Math.round(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const initials = (name = '?') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

export const STATUS = Object.fromEntries(
  Object.keys(statusColors).map((k) => [k, { label: statusLabels[k], color: statusColors[k] }]),
);

export const ROOM_CATEGORIES = {
  general: { label: 'Général', icon: 'house' },
  entraide: { label: 'Entraide', icon: 'handshake' },
  projet: { label: 'Projet', icon: 'rocket' },
  brainstorming: { label: 'Brainstorming', icon: 'lightbulb' },
  etude: { label: 'Étude', icon: 'book-open' },
  detente: { label: 'Détente', icon: 'coffee' },
  autre: { label: 'Autre', icon: 'message-circle' },
};

export const isTypingTarget = (el) =>
  el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable || el.tagName === 'SELECT');

export const inviteUrl = (code) => `${window.location.origin}/invite/${code}`;

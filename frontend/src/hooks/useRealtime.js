import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { socket } from '../lib/socket';
import { useApp } from '../store/app';
import { useAuth } from '../store/auth';
import { useChat } from '../store/chat';
import { sounds } from '../lib/sound';
import { api } from '../lib/api';

const IDLE_AFTER_MS = 5 * 60 * 1000;

/** Branche tous les événements temps réel globaux sur les stores. */
export function useRealtime() {
  const navigateFn = useNavigate();
  // useNavigate change d'identité à chaque changement de page : on passe par une ref
  // pour ne pas recréer la connexion temps réel à chaque navigation.
  const navRef = useRef(navigateFn);
  navRef.current = navigateFn;
  const wasConnected = useRef(false);

  useEffect(() => {
    const navigate = (...args) => navRef.current(...args);
    const app = useApp.getState;
    const me = () => useAuth.getState().user;

    const ackDelivered = (rooms) => {
      for (const r of rooms) {
        if (r.lastMessage && r.lastMessage.authorId !== me()?.id) {
          socket.emit('message:ack', { roomId: r.id, messageId: r.lastMessage.id, kind: 'delivered' });
        }
      }
    };

    const onConnect = async () => {
      app().setConnection('connected');
      if (wasConnected.current) toast.success('Connexion rétablie');
      wasConnected.current = true;
      try {
        const rooms = await app().loadRooms();
        ackDelivered(rooms);
        const active = app().activeRoomId;
        if (active) {
          app().refreshRoom(active);
          useChat.getState().load(active, { force: true }).catch(() => {});
          socket.emit('presence:room', { roomId: active });
        }
      } catch {
        /* ignoré : nouvelle tentative à la prochaine connexion */
      }
    };
    const onDisconnect = () => app().setConnection('disconnected');
    const onConnectError = (err) => {
      app().setConnection('disconnected');
      // Ne déconnecte que si la session est réellement invalide côté API.
      if (err.message === 'unauthorized') {
        api.get('/auth/me').catch((e) => e.status === 401 && useAuth.getState().logout());
      }
    };

    const onMessage = (msg) => {
      useChat.getState().receive(msg);
      const mine = msg.author?.id === me()?.id;
      const isActive = app().activeRoomId === msg.roomId && document.visibilityState === 'visible';
      app().patchRoom(msg.roomId, (r) => ({
        lastMessage: {
          id: msg.id,
          content: msg.content || (msg.attachment ? `Pièce jointe : ${msg.attachment.name}` : ''),
          type: msg.type,
          authorId: msg.author?.id,
          authorName: msg.author?.displayName,
          createdAt: msg.createdAt,
        },
        unread: mine || isActive || msg.type === 'system' ? r.unread : (r.unread || 0) + 1,
      }));
      if (!mine && msg.type === 'text') {
        socket.emit('message:ack', { roomId: msg.roomId, messageId: msg.id, kind: 'delivered' });
        if (!isActive && me()?.preferredStatus !== 'dnd') sounds.message();
      }
      if (msg.author) app().mergeUsers([msg.author]);
    };

    const onNotification = (n) => {
      app().addNotification(n);
      if (me()?.preferredStatus === 'dnd') return;
      sounds.notification();
      const title = n.type === 'mention' ? `${n.actor?.displayName} vous a mentionné` : n.type === 'dm' ? `Message de ${n.actor?.displayName}` : 'Notification';
      toast(title, {
        description: n.content,
        action: n.roomId ? { label: 'Ouvrir', onClick: () => navigate(`/r/${n.roomId}`) } : undefined,
      });
      if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`DevMeet — ${title}`, { body: n.content || '', icon: '/logo.svg' });
      }
    };

    const onRoomRemoved = ({ roomId }, deleted) => {
      const room = app().rooms.find((r) => r.id === roomId);
      app().removeRoom(roomId);
      useChat.getState().forget(roomId);
      if (app().activeRoomId === roomId) {
        navigate('/');
        toast.info(deleted ? `Le salon « ${room?.name || ''} » a été supprimé` : 'Vous ne faites plus partie de ce salon');
      }
    };

    const handlers = {
      connect: onConnect,
      disconnect: onDisconnect,
      connect_error: onConnectError,
      'presence:snapshot': (list) => app().setPresenceSnapshot(list),
      'presence:update': (p) => app().setPresence(p),
      'user:updated': (u) => {
        app().mergeUsers([u]);
        if (u.id === me()?.id) useAuth.setState({ user: { ...me(), ...u } });
      },
      'message:new': onMessage,
      'message:updated': (m) => useChat.getState().update(m),
      'message:reactions': ({ roomId, id, reactions }) => useChat.getState().setReactions(roomId, id, reactions),
      'receipt:update': (r) => app().setReceipt(r),
      typing: ({ roomId, userId, isTyping }) => app().setTyping(roomId, userId, isTyping),
      'voice:snapshot': (list) => list.forEach(({ roomId, participants }) => app().setVoice(roomId, participants)),
      'voice:update': ({ roomId, participants }) => app().setVoice(roomId, participants),
      'notification:new': onNotification,
      'room:added': ({ roomId }) => app().refreshRoom(roomId),
      'room:updated': (room) => app().patchRoom(room.id, room),
      'room:members-changed': ({ roomId }) => {
        const loaded = app().details[roomId] || app().activeRoomId === roomId;
        if (loaded) app().refreshRoom(roomId);
        else api_refreshMembers(roomId);
      },
      'room:removed': (p) => onRoomRemoved(p, false),
      'room:deleted': (p) => onRoomRemoved(p, true),
    };
    // Met à jour la liste des membres d'un salon non ouvert (compteurs de présence).
    const api_refreshMembers = (roomId) => app().refreshRoom(roomId);

    for (const [ev, fn] of Object.entries(handlers)) socket.on(ev, fn);
    socket.connect();
    app().loadNotifications().catch(() => {});
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => Notification.requestPermission().catch(() => {}), 4000);
    }

    // Expiration des indicateurs d'écriture
    const typingTimer = setInterval(() => app().pruneTyping(), 2000);

    // Détection d'inactivité → statut « Absent » automatique
    let idle = false;
    let idleTimer;
    const setActive = () => {
      clearTimeout(idleTimer);
      if (idle) {
        idle = false;
        socket.emit('presence:activity', { state: 'active' });
      }
      idleTimer = setTimeout(() => {
        idle = true;
        socket.emit('presence:activity', { state: 'idle' });
      }, IDLE_AFTER_MS);
    };
    const activityEvents = ['pointermove', 'keydown', 'pointerdown', 'wheel', 'focus'];
    let last = 0;
    const throttled = () => {
      const now = Date.now();
      if (now - last > 3000 || idle) {
        last = now;
        setActive();
      }
    };
    activityEvents.forEach((e) => window.addEventListener(e, throttled, { passive: true }));
    setActive();

    return () => {
      for (const [ev, fn] of Object.entries(handlers)) socket.off(ev, fn);
      clearInterval(typingTimer);
      clearTimeout(idleTimer);
      activityEvents.forEach((e) => window.removeEventListener(e, throttled));
      socket.disconnect();
    };
  }, []);
}

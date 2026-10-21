import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, MessageCircle } from 'lucide-react';
import { socket } from '../../lib/socket';
import { useChat } from '../../store/chat';
import { useApp } from '../../store/app';
import { useAuth } from '../../store/auth';
import MessageItem from './MessageItem';
import { Spinner } from '../ui/Spinner';
import { formatDay, sameDay } from '../../lib/utils';

const GROUP_MS = 5 * 60 * 1000;

export default function MessageList({ roomId, visible, onRetry, canModerate }) {
  const me = useAuth((s) => s.user);
  const chat = useChat((s) => s.rooms[roomId]);
  const room = useApp((s) => s.rooms.find((r) => r.id === roomId));
  const scroller = useRef(null);
  const atBottom = useRef(true);
  const prevHeight = useRef(null);
  const lastAcked = useRef(0);
  const [showJump, setShowJump] = useState(false);
  const [unreadMarker, setUnreadMarker] = useState(null);
  const items = chat?.items || [];

  // Position du séparateur « Nouveaux messages » figée à l'ouverture du salon.
  useEffect(() => {
    setUnreadMarker(room?.unread > 0 ? room.lastReadMessageId : null);
    lastAcked.current = 0;
    atBottom.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    useChat.getState().load(roomId).catch(() => {});
  }, [roomId]);

  const scrollToBottom = (smooth) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  // Conserve la position lors du chargement de l'historique, sinon colle en bas.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current != null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    } else {
      setShowJump(true);
    }
  }, [items.length]);

  // Accusés de lecture : on marque comme lu quand le salon est visible et qu'on est en bas.
  const markRead = useCallback(() => {
    if (!visible || document.visibilityState !== 'visible' || !atBottom.current) return;
    const last = [...items].reverse().find((m) => m.id);
    if (!last || last.id <= lastAcked.current) return;
    lastAcked.current = last.id;
    socket.emit('message:ack', { roomId, messageId: last.id, kind: 'read' });
    useApp.getState().patchRoom(roomId, { unread: 0, lastReadMessageId: last.id });
  }, [items, roomId, visible]);

  useEffect(() => {
    markRead();
    const onVis = () => markRead();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [markRead]);

  const onScroll = async () => {
    const el = scroller.current;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) {
      setShowJump(false);
      markRead();
    }
    if (el.scrollTop < 120 && chat?.hasMore && !chat.loading) {
      prevHeight.current = el.scrollHeight;
      const n = await useChat.getState().loadMore(roomId).catch(() => 0);
      if (!n) prevHeight.current = null;
    }
  };

  const jumpTo = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-accent-soft');
      setTimeout(() => el.classList.remove('bg-accent-soft'), 1500);
    }
  };

  const lastMineId = [...items].reverse().find((m) => m.author?.id === me.id && m.type !== 'system')?.clientId
    ?? [...items].reverse().find((m) => m.author?.id === me.id && m.type !== 'system')?.id;

  if (!chat?.loaded) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner className="text-muted" />
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto pb-2">
        {chat.loading && chat.hasMore && <div className="flex justify-center py-3"><Spinner className="size-4 text-muted" /></div>}
        {!chat.hasMore && (
          <div className="px-4 pt-6 pb-4">
            <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent"><MessageCircle className="size-6" /></span>
            <h3 className="font-semibold">Début de la conversation</h3>
            <p className="text-sm text-muted">{room?.type === 'dm' ? `Votre historique avec ${room.peer?.displayName}.` : `Bienvenue dans ${room?.name} ! Dites bonjour.`}</p>
          </div>
        )}
        {items.map((m, i) => {
          const prev = items[i - 1];
          const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
          const grouped =
            !newDay && prev && prev.type !== 'system' && m.type !== 'system' && prev.author?.id === m.author?.id &&
            new Date(m.createdAt) - new Date(prev.createdAt) < GROUP_MS && !m.replyTo;
          const showUnread = unreadMarker != null && m.id > unreadMarker && (!prev || !prev.id || prev.id <= unreadMarker) && m.author?.id !== me.id;
          return (
            <div key={m.clientId || m.id}>
              {newDay && (
                <div className="sticky top-0 z-[1] flex justify-center py-2">
                  <span className="rounded-full border border-line bg-panel/90 px-3 py-0.5 text-[11px] font-medium text-muted capitalize backdrop-blur">{formatDay(m.createdAt)}</span>
                </div>
              )}
              {showUnread && (
                <div className="my-1 flex items-center gap-2 px-4 text-[11px] font-semibold text-danger">
                  <span className="h-px flex-1 bg-danger/50" /> Nouveaux messages
                </div>
              )}
              <MessageItem
                message={m}
                grouped={grouped && !showUnread}
                me={me}
                canModerate={canModerate}
                isLastMine={(m.clientId ?? m.id) === lastMineId}
                onRetry={onRetry}
                onJump={jumpTo}
              />
            </div>
          );
        })}
      </div>
      {showJump && (
        <button
          onClick={() => scrollToBottom(true)}
          className="animate-pop-in absolute right-4 bottom-3 flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent shadow-pop"
        >
          <ArrowDown className="size-3.5" /> Nouveaux messages
        </button>
      )}
    </div>
  );
}

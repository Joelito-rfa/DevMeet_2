import { useCallback } from 'react';
import { toast } from 'sonner';
import { socket } from '../lib/socket';
import { upload } from '../lib/api';
import { useChat } from '../store/chat';
import { useAuth } from '../store/auth';
import { uid } from '../lib/utils';

/** Envoi optimiste : le message apparaît immédiatement puis est confirmé par le serveur. */
export function useSendMessage(roomId) {
  const emitMessage = useCallback(
    (pending) => {
      socket.timeout(15000).emit(
        'message:send',
        { roomId, content: pending.content, clientId: pending.clientId, replyToId: pending.replyTo?.id, attachment: pending.attachment },
        (err, res) => {
          if (err || res?.error) {
            useChat.getState().markFailed(roomId, pending.clientId);
            if (res?.error) toast.error(res.error);
          } else {
            useChat.getState().receive({ ...res.message, clientId: pending.clientId });
          }
        },
      );
    },
    [roomId],
  );

  const base = useCallback(
    (extra) => {
      const me = useAuth.getState().user;
      const replyTo = useChat.getState().replyTo[roomId];
      useChat.getState().setReplyTo(roomId, null);
      return {
        clientId: uid(),
        roomId,
        type: 'text',
        content: '',
        author: { id: me.id, displayName: me.displayName, avatarUrl: me.avatarUrl, accentColor: me.accentColor, username: me.username },
        reactions: [],
        createdAt: new Date().toISOString(),
        replyTo: replyTo ? { id: replyTo.id, content: replyTo.content || 'Pièce jointe', authorName: replyTo.author?.displayName } : null,
        ...extra,
      };
    },
    [roomId],
  );

  const sendText = useCallback(
    (content) => {
      const pending = base({ content });
      useChat.getState().addPending(roomId, pending);
      emitMessage(pending);
    },
    [base, emitMessage, roomId],
  );

  const sendFile = useCallback(
    async (file, meta = {}) => {
      if (file.size > 15 * 1024 * 1024) return toast.error(`« ${file.name} » dépasse 15 Mo`);
      const pending = base({ uploading: 0, uploadName: file.name });
      const store = useChat.getState();
      store.addPending(roomId, pending);
      const setProgress = (p) =>
        useChat.getState()._set(roomId, (c) => ({ items: c.items.map((m) => (m.clientId === pending.clientId ? { ...m, uploading: p } : m)) }));
      try {
        const { attachment } = await upload(`/rooms/${roomId}/attachments`, file, { onProgress: setProgress });
        const ready = { ...pending, uploading: undefined, attachment: { ...attachment, ...meta } };
        useChat.getState()._set(roomId, (c) => ({ items: c.items.map((m) => (m.clientId === pending.clientId ? ready : m)) }));
        emitMessage(ready);
      } catch (e) {
        useChat.getState().removePending(roomId, pending.clientId);
        toast.error(e.message);
      }
    },
    [base, emitMessage, roomId],
  );

  const sendFiles = useCallback((files) => [...files].forEach((f) => sendFile(f)), [sendFile]);

  const retry = useCallback(
    (msg) => {
      useChat.getState()._set(roomId, (c) => ({ items: c.items.map((m) => (m.clientId === msg.clientId ? { ...m, status: undefined } : m)) }));
      emitMessage(msg);
    },
    [emitMessage, roomId],
  );

  return { sendText, sendFile, sendFiles, retry };
}

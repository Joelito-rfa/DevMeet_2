import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Image as ImageIcon, FileText, Mic, SendHorizontal, X, Pencil, Reply, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { socket, emitAck } from '../../lib/socket';
import { useChat } from '../../store/chat';
import { useAuth } from '../../store/auth';
import { Popover } from '../ui/Popover';
import { Avatar } from '../ui/Avatar';
import { cn, formatDuration } from '../../lib/utils';

function useRecorder(onDone) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const rec = useRef(null);
  const chunks = useRef([]);
  const started = useRef(0);
  const cancelled = useRef(false);
  const timer = useRef(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      cancelled.current = false;
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(timer.current);
        setRecording(false);
        const duration = (Date.now() - started.current) / 1000;
        if (cancelled.current || duration < 0.6) return;
        const type = r.mimeType || 'audio/webm';
        const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File(chunks.current, `message-vocal-${Date.now()}.${ext}`, { type });
        onDone(file, duration);
      };
      r.start(250);
      rec.current = r;
      started.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timer.current = setInterval(() => {
        const s = (Date.now() - started.current) / 1000;
        setElapsed(s);
        if (s > 300) r.stop();
      }, 200);
    } catch {
      toast.error('Accès au microphone refusé');
    }
  };
  const stop = () => rec.current?.state === 'recording' && rec.current.stop();
  const cancel = () => {
    cancelled.current = true;
    stop();
  };
  useEffect(() => () => cancel(), []); // eslint-disable-line react-hooks/exhaustive-deps
  return { recording, elapsed, start, stop, cancel };
}

export default function Composer({ roomId, members = [], placeholder, sender }) {
  const me = useAuth((s) => s.user);
  const replyTo = useChat((s) => s.replyTo[roomId]);
  const editing = useChat((s) => (s.editing?.roomId === roomId ? s.editing : null));
  const [text, setText] = useState('');
  const [mention, setMention] = useState(null); // { query, start, index }
  const ta = useRef(null);
  const fileInput = useRef(null);
  const imageInput = useRef(null);
  const typingTimer = useRef(null);
  const isTyping = useRef(false);
  const recorder = useRecorder((file, duration) => sender.sendFile(file, { kind: 'audio', duration }));

  useEffect(() => {
    if (editing) {
      setText(editing.content);
      setTimeout(() => ta.current?.focus(), 0);
    }
  }, [editing]);

  useEffect(() => {
    if (replyTo) ta.current?.focus();
  }, [replyTo]);

  useEffect(() => {
    setText('');
    return () => stopTyping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Hauteur automatique
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  const stopTyping = () => {
    clearTimeout(typingTimer.current);
    if (isTyping.current) {
      isTyping.current = false;
      socket.emit('typing', { roomId, isTyping: false });
    }
  };

  const onChange = (e) => {
    const v = e.target.value;
    setText(v);
    if (!editing) {
      if (!isTyping.current && v.trim()) {
        isTyping.current = true;
        socket.emit('typing', { roomId, isTyping: true });
      }
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(stopTyping, 3000);
      if (!v.trim()) stopTyping();
    }
    const caret = e.target.selectionStart;
    const m = v.slice(0, caret).match(/(?:^|\s)@([a-z0-9_.]{0,32})$/i);
    setMention(m ? { query: m[1].toLowerCase(), start: caret - m[1].length - 1, index: 0 } : null);
  };

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const list = members
      .filter((m) => m.id !== me.id && (m.username.includes(mention.query) || m.displayName.toLowerCase().includes(mention.query)))
      .slice(0, 6);
    if ('tous'.startsWith(mention.query)) list.push({ id: 'all', username: 'tous', displayName: 'Tout le salon' });
    return list;
  }, [mention, members, me.id]);

  const insertMention = (u) => {
    const before = text.slice(0, mention.start);
    const after = text.slice(ta.current.selectionStart);
    const next = `${before}@${u.username} ${after}`;
    setText(next);
    setMention(null);
    setTimeout(() => {
      const pos = before.length + u.username.length + 2;
      ta.current.focus();
      ta.current.setSelectionRange(pos, pos);
    }, 0);
  };

  const submit = async () => {
    const content = text.trim();
    if (editing) {
      if (content !== editing.content) {
        await emitAck('message:edit', { id: editing.id, content }).catch((e) => toast.error(e.message));
      }
      useChat.getState().setEditing(null);
      setText('');
      return;
    }
    if (!content) return;
    sender.sendText(content);
    setText('');
    stopTyping();
  };

  const onKeyDown = (e) => {
    if (mention && suggestions.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setMention((m) => ({ ...m, index: (m.index + d + suggestions.length) % suggestions.length }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(suggestions[mention.index]);
        return;
      }
      if (e.key === 'Escape') return setMention(null);
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') {
      if (editing) {
        useChat.getState().setEditing(null);
        setText('');
      } else if (replyTo) useChat.getState().setReplyTo(roomId, null);
    }
    if (e.key === 'ArrowUp' && !text) {
      const items = useChat.getState().rooms[roomId]?.items || [];
      const last = [...items].reverse().find((m) => m.author?.id === me.id && m.id && !m.deletedAt && m.content);
      if (last) {
        e.preventDefault();
        useChat.getState().setEditing(last);
      }
    }
  };

  const onPaste = (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) {
      e.preventDefault();
      sender.sendFiles(files);
    }
  };

  if (recorder.recording) {
    return (
      <div className="p-3">
        <div className="flex items-center gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-3 py-2.5">
          <span className="size-2.5 animate-pulse rounded-full bg-danger" />
          <span className="font-mono text-sm text-danger">{formatDuration(recorder.elapsed)}</span>
          <div className="flex h-6 flex-1 items-center gap-[3px] overflow-hidden">
            {Array.from({ length: 40 }).map((_, i) => (
              <span key={i} className="w-[3px] animate-pulse rounded-full bg-danger/60" style={{ height: `${30 + ((i * 37) % 70)}%`, animationDelay: `${(i % 7) * 0.1}s` }} />
            ))}
          </div>
          <button onClick={recorder.cancel} title="Annuler" className="grid size-9 place-items-center rounded-xl text-muted hover:bg-hover hover:text-fg"><Trash2 className="size-4" /></button>
          <button onClick={recorder.stop} title="Envoyer" className="grid size-9 place-items-center rounded-xl bg-accent text-on-accent transition hover:bg-accent-hover"><SendHorizontal className="size-4" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative px-3 pb-3">
      {mention && suggestions.length > 0 && (
        <div className="animate-pop-in absolute right-3 bottom-full left-3 mb-1 overflow-hidden rounded-xl border border-line bg-elevated p-1 shadow-pop">
          <div className="px-2 py-1 text-[11px] font-semibold text-subtle uppercase">Mentionner</div>
          {suggestions.map((u, i) => (
            <button key={u.id} onMouseDown={(e) => { e.preventDefault(); insertMention(u); }} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm', i === mention.index && 'bg-selected')}>
              {u.id === 'all' ? <span className="grid size-6 place-items-center rounded-full bg-accent text-[10px] text-on-accent">@</span> : <Avatar user={u} size="xs" showStatus />}
              <span className="font-medium">{u.displayName}</span>
              <span className="text-xs text-subtle">@{u.username}</span>
            </button>
          ))}
        </div>
      )}
      <div className="rounded-2xl border border-line bg-input transition focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/10">
        {(replyTo || editing) && (
          <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-xs text-muted">
            {editing ? <Pencil className="size-3.5 text-accent" /> : <Reply className="size-3.5 text-accent" />}
            <span className="min-w-0 flex-1 truncate">
              {editing ? 'Modification du message' : <>Réponse à <b className="text-fg">{replyTo.author?.displayName}</b> : {replyTo.content || 'pièce jointe'}</>}
            </span>
            <button
              onClick={() => {
                if (editing) {
                  useChat.getState().setEditing(null);
                  setText('');
                } else useChat.getState().setReplyTo(roomId, null);
              }}
              className="grid size-5 place-items-center rounded hover:bg-hover hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <textarea
          ref={ta}
          rows={1}
          value={text}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => setTimeout(() => setMention(null), 150)}
          placeholder={placeholder || 'Écrire un message…'}
          className="block max-h-[180px] min-h-[44px] w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-[14.5px] outline-none placeholder:text-subtle"
        />
        <div className="flex items-center gap-0.5 px-2 pb-2">
          <Popover
            side="top"
            align="start"
            className="w-52 p-1"
            trigger={({ toggle }) => (
              <button onClick={toggle} title="Joindre" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"><Plus className="size-[18px]" /></button>
            )}
          >
            {(close) => (
              <>
                <button onClick={() => { close(); imageInput.current.click(); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-hover"><ImageIcon className="size-4 text-muted" /> Image ou vidéo</button>
                <button onClick={() => { close(); fileInput.current.click(); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-hover"><FileText className="size-4 text-muted" /> Fichier</button>
              </>
            )}
          </Popover>
          <button onClick={() => imageInput.current.click()} title="Image" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"><ImageIcon className="size-[18px]" /></button>
          <button onClick={() => fileInput.current.click()} title="Fichier" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"><FileText className="size-[18px]" /></button>
          <button onClick={recorder.start} title="Message vocal" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"><Mic className="size-[18px]" /></button>
          <div className="flex-1" />
          <button
            onClick={submit}
            disabled={!text.trim() && !editing}
            title="Envoyer (Entrée)"
            className="ml-1 grid size-8 place-items-center rounded-lg bg-accent text-on-accent transition hover:bg-accent-hover disabled:bg-transparent disabled:text-subtle"
          >
            {editing ? <Check className="size-4" /> : <SendHorizontal className="size-[18px]" />}
          </button>
        </div>
      </div>
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => { sender.sendFiles(e.target.files); e.target.value = ''; }} />
      <input ref={imageInput} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { sender.sendFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

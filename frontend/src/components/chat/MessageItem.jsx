import { memo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SmilePlus, Reply, Pencil, Trash2, Copy, FileText, Download, RotateCcw, X, CornerUpLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '../ui/Avatar';
import { Popover } from '../ui/Popover';
import ReactionPicker from './ReactionPicker';
import AudioPlayer from './AudioPlayer';
import MessageStatus from './MessageStatus';
import { emitAck } from '../../lib/socket';
import { useApp } from '../../store/app';
import { useChat } from '../../store/chat';
import { cn, formatTime, formatFull, formatBytes } from '../../lib/utils';
import { QUICK_REACTIONS, getReactionIcon, getIconLabel } from '../../lib/icons';

const TOKEN_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])|(@[a-z0-9_.]{3,32})|(`[^`\n]+`)|(\*\*[^*\n]+\*\*)/gi;

export function RichText({ text, meUsername }) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [tok] = m;
    if (m[1]) parts.push(<a key={m.index} href={tok} target="_blank" rel="noreferrer noopener" className="text-accent underline-offset-2 hover:underline break-all">{tok}</a>);
    else if (m[2]) {
      const self = tok.slice(1).toLowerCase() === meUsername || ['@tous', '@everyone'].includes(tok.toLowerCase());
      parts.push(<span key={m.index} className={cn('rounded px-1 font-medium', self ? 'bg-warning/20 text-warning' : 'bg-accent-soft text-accent')}>{tok}</span>);
    } else if (m[3]) parts.push(<code key={m.index} className="rounded-md bg-panel-2 px-1.5 py-0.5 font-mono text-[0.85em] ring-1 ring-line">{tok.slice(1, -1)}</code>);
    else if (m[4]) parts.push(<strong key={m.index}>{tok.slice(2, -2)}</strong>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function Lightbox({ src, name, onClose }) {
  return createPortal(
    <div className="animate-fade-in fixed inset-0 z-[90] flex flex-col bg-black/90 backdrop-blur" onClick={onClose}>
      <div className="flex items-center justify-between p-4 text-on-accent">
        <span className="truncate text-sm">{name}</span>
        <div className="flex gap-2">
          <a href={`${src}?download=${encodeURIComponent(name)}`} onClick={(e) => e.stopPropagation()} className="grid size-9 place-items-center rounded-lg hover:bg-white/10"><Download className="size-5" /></a>
          <button className="grid size-9 place-items-center rounded-lg hover:bg-white/10"><X className="size-5" /></button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <img src={src} alt={name} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
      </div>
    </div>,
    document.body,
  );
}

function Attachment({ a, mine }) {
  const [open, setOpen] = useState(false);
  if (a.kind === 'image') {
    return (
      <>
        <button onClick={() => setOpen(true)} className="mt-1 block overflow-hidden rounded-xl border border-line">
          <img src={a.url} alt={a.name} loading="lazy" className="max-h-64 max-w-full object-cover transition hover:opacity-90 sm:max-w-[320px]" />
        </button>
        {open && <Lightbox src={a.url} name={a.name} onClose={() => setOpen(false)} />}
      </>
    );
  }
  if (a.kind === 'audio') return <div className="mt-1"><AudioPlayer src={a.url} duration={a.duration} mine={mine} /></div>;
  if (a.kind === 'video') return <video src={a.url} controls className="mt-1 max-h-64 max-w-full rounded-xl border border-line sm:max-w-[360px]" />;
  return (
    <a href={`${a.url}?download=${encodeURIComponent(a.name)}`} className="mt-1 flex w-[280px] max-w-full items-center gap-3 rounded-xl border border-line bg-panel-2 p-3 transition hover:border-accent/40">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><FileText className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{a.name}</span>
        <span className="text-xs text-muted">{formatBytes(a.size)}</span>
      </span>
      <Download className="size-4 text-muted" />
    </a>
  );
}

function Reactions({ message, meId }) {
  const users = useApp((s) => s.users);
  if (!message.reactions?.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {message.reactions.map((r) => {
        const mine = r.userIds.includes(meId);
        const Icon = getReactionIcon(r.icon);
        const names = r.userIds.map((id) => users[id]?.displayName || '…').join(', ');
        return (
          <button
            key={r.icon}
            title={names}
            aria-label={`${getIconLabel(r.icon)} — ${names}`}
            onClick={() => emitAck('message:react', { id: message.id, icon: r.icon }).catch((e) => toast.error(e.message))}
            className={cn('flex h-7 items-center gap-1 rounded-full border px-2 text-xs transition', mine ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line bg-panel-2 text-muted hover:border-line-strong')}
          >
            <Icon className="size-3.5" />
            <span className="font-semibold">{r.userIds.length}</span>
          </button>
        );
      })}
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} title={label} className={cn('grid size-8 place-items-center rounded-lg transition', danger ? 'text-muted hover:bg-danger/10 hover:text-danger' : 'text-muted hover:bg-hover hover:text-fg')}>
      <Icon className="size-4" />
    </button>
  );
}

function MessageItem({ message, grouped, me, canModerate, isLastMine, onRetry, onJump }) {
  const mine = message.author?.id === me.id;
  const [pickerOpen, setPickerOpen] = useState(false);

  if (message.type === 'system') {
    return (
      <div className="flex items-center gap-3 px-4 py-2 text-xs text-subtle">
        <span className="h-px flex-1 bg-line" />
        <span>{message.content} · {formatTime(message.createdAt)}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    );
  }

  const react = (icon) => {
    setPickerOpen(false);
    emitAck('message:react', { id: message.id, icon }).catch((e) => toast.error(e.message));
  };
  const remove = () => emitAck('message:delete', { id: message.id }).catch((e) => toast.error(e.message));
  const deleted = !!message.deletedAt;

  return (
    <div id={message.id ? `msg-${message.id}` : undefined} className={cn('group relative flex gap-3 px-4 transition-colors hover:bg-hover/50', grouped ? 'py-0.5' : 'pt-3 pb-0.5', message.status === 'failed' && 'bg-danger/5')}>
      <div className="w-9 shrink-0">
        {!grouped ? (
          <Avatar user={message.author} size="md" />
        ) : (
          <span className="hidden pt-1 text-[10px] text-subtle group-hover:block">{formatTime(message.createdAt)}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold" style={{ color: message.author?.accentColor ? undefined : undefined }}>
              {message.author?.displayName || 'Utilisateur supprimé'}
            </span>
            <span className="text-[11px] text-subtle" title={formatFull(message.createdAt)}>{formatTime(message.createdAt)}</span>
          </div>
        )}
        {message.replyTo && (
          <button onClick={() => onJump?.(message.replyTo.id)} className="mt-0.5 mb-1 flex max-w-full items-center gap-1.5 rounded-lg border-l-2 border-accent bg-panel-2 px-2 py-1 text-left text-xs text-muted hover:text-fg">
            <CornerUpLeft className="size-3 shrink-0" />
            <b className="shrink-0 font-semibold">{message.replyTo.authorName}</b>
            <span className="truncate">{message.replyTo.content}</span>
          </button>
        )}
        {deleted ? (
          <p className="text-sm text-subtle italic">Ce message a été supprimé</p>
        ) : (
          <>
            {message.content && (
              <p className={cn('text-[14.5px] leading-relaxed break-words whitespace-pre-wrap', !message.id && 'opacity-70')}>
                <RichText text={message.content} meUsername={me.username} />
                {message.editedAt && <span className="ml-1 text-[10px] text-subtle" title={formatFull(message.editedAt)}>(modifié)</span>}
              </p>
            )}
            {message.attachment && <Attachment a={message.attachment} mine={mine} />}
            {message.uploading != null && (
              <div className="mt-1 w-56 rounded-xl border border-line bg-panel-2 p-2.5 text-xs text-muted">
                Envoi de {message.uploadName}… {Math.round(message.uploading * 100)}%
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line"><div className="h-full bg-accent transition-all" style={{ width: `${message.uploading * 100}%` }} /></div>
              </div>
            )}
            <Reactions message={message} meId={me.id} />
          </>
        )}
        {mine && (isLastMine || !message.id || message.status === 'failed') && (
          <div className="mt-0.5 flex items-center gap-2">
            <MessageStatus message={message} showLabel />
            {message.status === 'failed' && (
              <button onClick={() => onRetry(message)} className="flex items-center gap-1 text-[11px] font-medium text-danger hover:underline">
                <RotateCcw className="size-3" /> Réessayer
              </button>
            )}
          </div>
        )}
        {mine && !isLastMine && message.id && !deleted && (
          <span className="absolute right-3 bottom-1 opacity-70"><MessageStatus message={message} /></span>
        )}
      </div>

      {message.id && !deleted && (
        <div className={cn('absolute -top-4 right-4 z-10 hidden items-center rounded-xl border border-line bg-elevated p-0.5 shadow-pop group-hover:flex', pickerOpen && 'flex')}>
          {QUICK_REACTIONS.slice(0, 3).map((name) => {
            const Icon = getReactionIcon(name);
            return (
              <button key={name} title={getIconLabel(name)} aria-label={getIconLabel(name)} onClick={() => react(name)} className="grid size-8 place-items-center rounded-lg text-muted transition hover:scale-110 hover:bg-hover hover:text-fg">
                <Icon className="size-4" />
              </button>
            );
          })}
          <Popover open={pickerOpen} onOpenChange={setPickerOpen} side="bottom" align="end" trigger={({ toggle }) => <ActionBtn icon={SmilePlus} label="Réagir" onClick={toggle} />}>
            {() => <ReactionPicker onPick={react} />}
          </Popover>
          <ActionBtn icon={Reply} label="Répondre" onClick={() => useChat.getState().setReplyTo(message.roomId, message)} />
          {message.content && <ActionBtn icon={Copy} label="Copier" onClick={() => navigator.clipboard.writeText(message.content).then(() => toast.success('Message copié'))} />}
          {mine && <ActionBtn icon={Pencil} label="Modifier" onClick={() => useChat.getState().setEditing(message)} />}
          {(mine || canModerate) && <ActionBtn icon={Trash2} label="Supprimer" danger onClick={remove} />}
        </div>
      )}
    </div>
  );
}

export default memo(MessageItem);

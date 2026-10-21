import { useApp } from '../../store/app';
import { useAuth } from '../../store/auth';

export default function TypingIndicator({ roomId }) {
  const typing = useApp((s) => s.typing[roomId]);
  const users = useApp((s) => s.users);
  const me = useAuth((s) => s.user);
  const ids = Object.keys(typing || {}).map(Number).filter((id) => id !== me.id);
  if (!ids.length) return <div className="h-5" />;
  const names = ids.map((id) => users[id]?.displayName?.split(' ')[0] || 'Quelqu’un');
  const text =
    names.length === 1 ? `${names[0]} est en train d’écrire` : names.length === 2 ? `${names[0]} et ${names[1]} écrivent` : `${names.length} personnes écrivent`;
  return (
    <div className="flex h-5 items-center gap-2 px-4 text-xs text-muted">
      <span className="flex gap-0.5">
        <span className="typing-dot size-1.5 rounded-full bg-accent" />
        <span className="typing-dot size-1.5 rounded-full bg-accent" />
        <span className="typing-dot size-1.5 rounded-full bg-accent" />
      </span>
      <span className="truncate"><b className="font-semibold text-fg">{text}</b>…</span>
    </div>
  );
}

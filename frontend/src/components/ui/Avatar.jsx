import { memo } from 'react';
import { useApp } from '../../store/app';
import { useAuth } from '../../store/auth';
import { cn, initials, STATUS } from '../../lib/utils';
import { avatarFallback, avatarGradient } from '../../lib/tokens';

export function useUserStatus(userId) {
  const me = useAuth((s) => s.user);
  const presence = useApp((s) => s.presence[userId]);
  const connection = useApp((s) => s.connection);
  if (me && me.id === userId) {
    if (connection !== 'connected') return 'offline';
    return presence?.status === 'idle' && me.preferredStatus === 'online' ? 'idle' : me.preferredStatus || 'online';
  }
  return presence?.status || 'offline';
}

const sizes = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-20 text-2xl',
  '2xl': 'size-28 text-4xl',
};
const dotSizes = { xs: 'size-2.5', sm: 'size-3', md: 'size-3', lg: 'size-3.5', xl: 'size-5', '2xl': 'size-6' };

function StatusDot({ status, size = 'md', className }) {
  const s = STATUS[status] || STATUS.offline;
  return (
    <span
      title={s.label}
      className={cn('absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-panel', dotSizes[size], className)}
      style={{ background: status === 'offline' || status === 'invisible' ? 'transparent' : s.color, boxShadow: status === 'offline' || status === 'invisible' ? `inset 0 0 0 2px ${STATUS.offline.color}` : undefined }}
    >
      {status === 'dnd' && <span className="absolute inset-x-[22%] top-1/2 h-[2px] -translate-y-1/2 rounded bg-panel" />}
    </span>
  );
}

function AvatarBase({ user, userId, size = 'md', showStatus = false, speaking = false, className, statusClassName }) {
  const cached = useApp((s) => (userId ? s.users[userId] : null));
  const u = user || cached || { displayName: '?' };
  const status = useUserStatus(u.id ?? userId);
  const color = u.accentColor || avatarFallback;
  return (
    <span className={cn('relative inline-flex shrink-0 select-none', sizes[size], className)}>
      <span
        className={cn(
          'grid size-full place-items-center overflow-hidden rounded-full font-semibold text-on-accent transition-shadow',
          speaking && 'speaking-ring',
        )}
        style={u.avatarUrl ? undefined : avatarGradient(color)}
      >
        {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="size-full object-cover" draggable={false} /> : initials(u.displayName)}
      </span>
      {showStatus && <StatusDot status={status} size={size} className={statusClassName} />}
    </span>
  );
}

export const Avatar = memo(AvatarBase);
export { StatusDot };

export function AvatarStack({ userIds, max = 4, size = 'xs' }) {
  const shown = userIds.slice(0, max);
  const rest = userIds.length - shown.length;
  return (
    <div className="flex -space-x-1.5">
      {shown.map((id) => (
        <Avatar key={id} userId={id} size={size} className="rounded-full ring-2 ring-panel" />
      ))}
      {rest > 0 && (
        <span className="grid size-6 place-items-center rounded-full bg-elevated text-[10px] font-semibold text-muted ring-2 ring-panel">
          +{rest}
        </span>
      )}
    </div>
  );
}

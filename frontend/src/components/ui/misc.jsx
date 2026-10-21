import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { avatarFallback, roomGradient } from '../../lib/tokens';
import { getIcon } from '../../lib/icons';

const roomIconVariants = cva('grid shrink-0 place-items-center', {
  variants: {
    size: {
      sm: 'size-7 rounded-lg',
      md: 'size-9 rounded-xl',
      lg: 'size-12 rounded-2xl',
      xl: 'size-16 rounded-2xl',
    },
  },
  defaultVariants: { size: 'md' },
});

const roomIconSize = {
  sm: 'size-3.5',
  md: 'size-[18px]',
  lg: 'size-5',
  xl: 'size-7',
};

export function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('focus-ring relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-line-strong', disabled && 'opacity-50')}
    >
      <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-on-accent shadow transition-transform', checked && 'translate-x-5')} />
    </button>
  );
}

export function Tabs({ tabs, value, onChange, className, size = 'md' }) {
  return (
    <div className={cn('flex gap-1 rounded-xl bg-panel-2 p-1', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'focus-ring flex flex-1 items-center justify-center gap-1.5 rounded-lg font-medium transition',
            size === 'sm' ? 'h-7 text-xs' : 'h-8 text-sm',
            value === t.value ? 'bg-selected text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:bg-hover hover:text-fg',
          )}
        >
          {t.icon && <t.icon className="size-4" />}
          {t.label}
          {t.badge ? <span className="rounded-full bg-accent px-1.5 text-[10px] leading-4 font-bold text-on-accent">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {Icon && (
        <span className="mb-4 grid size-14 place-items-center rounded-2xl border border-line bg-panel-2 text-muted">
          <Icon className="size-6" />
        </span>
      )}
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function RoomIcon({ room, size = 'md', className }) {
  const Icon = getIcon(room?.icon);
  return (
    <span className={cn(roomIconVariants({ size }), className)} style={roomGradient(room?.color || avatarFallback)}>
      <Icon className={roomIconSize[size] || roomIconSize.md} style={{ color: room?.color || avatarFallback }} />
    </span>
  );
}

export function Kbd({ children }) {
  return <kbd className="rounded-md border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">{children}</kbd>;
}

import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function Skeleton({ className }) {
  return <div className={cn('skeleton-shimmer rounded-lg', className)} />;
}

export function TypingDots({ className }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="typing-dot size-1.5 rounded-full bg-muted"
          animate={{ y: [0, -3, 0], opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}

export function Progress({ value = 0, className }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-panel-2', className)}>
      <motion.div
        className="h-full rounded-full bg-accent"
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  );
}

export function Separator({ className }) {
  return <div className={cn('h-px bg-line', className)} />;
}

import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva('inline-flex shrink-0 items-center gap-1 rounded-full font-semibold whitespace-nowrap', {
  variants: {
    tone: {
      default: 'bg-panel-2 text-muted ring-1 ring-line',
      accent: 'bg-accent-soft text-accent ring-1 ring-accent/30',
      success: 'bg-success/10 text-success ring-1 ring-success/30',
      warning: 'bg-idle/10 text-idle ring-1 ring-idle/30',
      danger: 'bg-danger/10 text-danger ring-1 ring-danger/30',
    },
    size: { xs: 'px-1.5 py-0.5 text-[10px]', sm: 'px-2 py-0.5 text-[11px]', md: 'px-2.5 py-1 text-xs' },
  },
  defaultVariants: { tone: 'default', size: 'sm' },
});

export function Badge({ tone, size, className, ...props }) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
export { badgeVariants };

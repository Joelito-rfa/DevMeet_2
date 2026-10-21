import { motion } from 'framer-motion';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { slideUp } from '../../lib/motion';

const cardVariants = cva('rounded-2xl border border-line bg-panel', {
  variants: {
    padding: { none: 'p-0', sm: 'p-3', md: 'p-4', lg: 'p-6' },
    hover: { true: 'transition hover:border-line-strong', false: '' },
  },
  defaultVariants: { padding: 'md', hover: false },
});

export function Card({ padding, hover, animate, className, ...props }) {
  const Comp = animate ? motion.div : 'div';
  const anim = animate ? { ...slideUp } : {};
  return <Comp className={cn(cardVariants({ padding, hover }), className)} {...anim} {...props} />;
}
export { cardVariants };

export function CardHeader({ className, ...props }) {
  return <div className={cn('mb-3 flex items-start justify-between gap-3', className)} {...props} />;
}
export function CardTitle({ className, ...props }) {
  return <h3 className={cn('font-semibold text-fg', className)} {...props} />;
}
export function CardDescription({ className, ...props }) {
  return <p className={cn('mt-0.5 text-sm text-muted', className)} {...props} />;
}

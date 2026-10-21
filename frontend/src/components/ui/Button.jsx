import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';

const buttonVariants = cva(
  'focus-ring inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-hover',
        secondary: 'border border-line bg-panel-2 text-fg hover:bg-hover hover:border-line-strong',
        ghost: 'text-muted hover:bg-hover hover:text-fg',
        danger: 'border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20',
        success: 'bg-success text-on-accent hover:bg-success/90',
      },
      size: {
        xs: 'h-7 gap-1 rounded-lg px-2 text-xs',
        sm: 'h-8 gap-1.5 rounded-lg px-3 text-sm',
        md: 'h-10 gap-2 rounded-xl px-4 text-sm',
        lg: 'h-12 gap-2 rounded-xl px-5 text-base',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export { buttonVariants };

export const Button = forwardRef(function Button(
  { variant, size, loading, icon: Icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      disabled={disabled || loading}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : Icon && <Icon className={size === 'xs' ? 'size-3.5' : 'size-4'} />}
      {children}
    </motion.button>
  );
});

const iconButtonVariants = cva(
  'focus-ring relative inline-grid shrink-0 place-items-center text-muted transition hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      size: { sm: 'size-8 rounded-lg', md: 'size-9 rounded-xl', lg: 'size-10 rounded-xl' },
      active: { true: 'bg-selected text-accent hover:bg-selected hover:text-accent', false: '' },
    },
    defaultVariants: { size: 'md', active: false },
  },
);

export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, active, size = 'md', className, badge, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.92 }}
      transition={{ duration: 0.12 }}
      className={cn(iconButtonVariants({ size, active: Boolean(active) }), className)}
      {...props}
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-[18px]'} />
      {badge ? (
        <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-on-accent ring-2 ring-panel">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </motion.button>
  );
});

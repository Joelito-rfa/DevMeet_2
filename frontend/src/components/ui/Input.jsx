import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const inputVariants = cva(
  'w-full rounded-xl border border-line bg-input text-sm text-fg placeholder:text-subtle transition outline-none focus:border-accent/70 focus:ring-4 focus:ring-accent/15 disabled:opacity-50',
  {
    variants: { size: { sm: 'px-3 py-1.5', md: 'px-3.5 py-2.5', lg: 'px-4 py-3 text-base' } },
    defaultVariants: { size: 'md' },
  },
);

export const Input = forwardRef(function Input({ size, className, ...props }, ref) {
  return <input ref={ref} className={cn(inputVariants({ size }), className)} {...props} />;
});

export function Textarea({ className, ...props }) {
  return <textarea className={cn(inputVariants({ size: 'md' }), 'min-h-20 resize-y', className)} {...props} />;
}

export function Label({ className, ...props }) {
  return <label className={cn('mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase', className)} {...props} />;
}

export function FieldError({ children, className }) {
  if (!children) return null;
  return <p className={cn('mt-1 text-xs text-danger', className)}>{children}</p>;
}

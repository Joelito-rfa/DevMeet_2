import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { textVariants } from '../../lib/text';

const textSize = cva('', {
  variants: {
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
      inherit: '',
    },
  },
  defaultVariants: { size: 'inherit' },
});

export function UiText({ tone = 'default', size = 'inherit', className, as: Tag = 'span', ...props }) {
  return <Tag className={cn(textVariants({ tone }), textSize({ size }), className)} {...props} />;
}

export function Muted({ className, ...props }) {
  return <span className={cn(textVariants({ tone: 'muted' }), className)} {...props} />;
}

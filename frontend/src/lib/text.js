import { cva } from 'class-variance-authority';
import { cn } from './utils';

// Tons de texte centralisés — tout `text-*` sémantique doit passer par ici.
// Mappe chaque intention vers un token du design system (jamais de teinte brute).
export const textVariants = cva('', {
  variants: {
    tone: {
      default: 'text-fg',
      muted: 'text-muted',
      subtle: 'text-subtle',
      accent: 'text-accent',
      success: 'text-success',
      warning: 'text-warning',
      danger: 'text-danger',
      info: 'text-info',
      inherit: '',
    },
  },
  defaultVariants: { tone: 'default' },
});

export function Text({ tone, className, as: Tag = 'span', ...props }) {
  return <Tag className={cn(textVariants({ tone }), className)} {...props} />;
}

// Badges / pastilles dot centralisés (évite bg-emerald-400 & co en dur)
export const dotVariants = cva('rounded-full', {
  variants: {
    tone: {
      success: 'bg-success',
      warning: 'bg-warning',
      danger: 'bg-danger',
      info: 'bg-info',
      accent: 'bg-accent',
      muted: 'bg-subtle',
    },
  },
  defaultVariants: { tone: 'success' },
});

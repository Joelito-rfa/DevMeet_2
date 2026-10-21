import { useState } from 'react';
import { cn } from '../../lib/utils';
import { REACTION_CATEGORIES, getReactionIcon, getIconLabel } from '../../lib/icons';

/** Sélecteur de réactions : des icônes UI (lucide) au lieu d'emoji. */
export default function ReactionPicker({ onPick, className }) {
  const [cat, setCat] = useState('Fréquents');
  return (
    <div className={cn('w-[300px]', className)}>
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line p-1.5">
        {Object.keys(REACTION_CATEGORIES).map((c) => (
          <button key={c} onClick={() => setCat(c)} className={cn('shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium', cat === c ? 'bg-selected text-fg' : 'text-muted hover:bg-hover')}>
            {c}
          </button>
        ))}
      </div>
      <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto p-2">
        {REACTION_CATEGORIES[cat].map((name) => {
          const Icon = getReactionIcon(name);
          const label = getIconLabel(name);
          return (
            <button
              key={name}
              title={label}
              aria-label={label}
              onClick={() => onPick(name)}
              className="grid size-8 place-items-center rounded-lg text-muted transition hover:scale-110 hover:bg-hover hover:text-fg"
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

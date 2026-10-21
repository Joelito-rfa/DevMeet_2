import {
  MousePointer2, Hand, Pencil, Brush, Highlighter, Eraser, Minus, Square, Circle, MoveUpRight, Type, StickyNote, PaintBucket,
  Pipette, MoreHorizontal, Diamond, Triangle,
} from 'lucide-react';
import { Popover } from '../ui/Popover';
import { cn } from '../../lib/utils';

export const TOOLS = [
  { id: 'select', label: 'Sélection', icon: MousePointer2, key: 'V' },
  { id: 'hand', label: 'Déplacer', icon: Hand, key: 'H' },
  { id: 'pencil', label: 'Crayon', icon: Pencil, key: 'P' },
  { id: 'brush', label: 'Pinceau', icon: Brush, key: 'B' },
  { id: 'eraser', label: 'Gomme', icon: Eraser, key: 'E' },
  { id: 'line', label: 'Ligne', icon: Minus, key: 'L' },
  { id: 'rect', label: 'Rectangle', icon: Square, key: 'R' },
  { id: 'ellipse', label: 'Cercle', icon: Circle, key: 'O' },
  { id: 'arrow', label: 'Flèche', icon: MoveUpRight, key: 'A' },
  { id: 'text', label: 'Texte', icon: Type, key: 'T' },
  { id: 'sticky', label: 'Post-it', icon: StickyNote, key: 'N' },
  { id: 'fill', label: 'Remplir', icon: PaintBucket, key: 'F' },
  { id: 'eyedropper', label: 'Pipette', icon: Pipette, key: 'I' },
];

export const EXTRA_TOOLS = [
  { id: 'highlighter', label: 'Surligneur', icon: Highlighter, key: 'M' },
  { id: 'diamond', label: 'Losange', icon: Diamond, key: 'D' },
  { id: 'triangle', label: 'Triangle', icon: Triangle, key: 'G' },
];

function ToolButton({ tool, active, onClick, disabled }) {
  const Icon = tool.icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`${tool.label} (${tool.key})`}
      className={cn(
        'group flex h-[58px] w-[60px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition disabled:opacity-35',
        active ? 'bg-selected text-accent ring-1 ring-line' : 'text-muted hover:bg-hover hover:text-fg',
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} />
      <span className="max-w-full truncate px-0.5">{tool.label}</span>
    </button>
  );
}

export default function Toolbar({ tool, setTool, readOnly }) {
  const extraActive = EXTRA_TOOLS.find((t) => t.id === tool);
  return (
    <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto rounded-2xl border border-line bg-panel p-1 shadow-pop">
      {TOOLS.map((t) => (
        <ToolButton key={t.id} tool={t} active={tool === t.id} onClick={() => setTool(t.id)} disabled={readOnly && !['select', 'hand'].includes(t.id)} />
      ))}
      <Popover
        side="bottom"
        align="end"
        className="p-1"
        trigger={({ toggle }) => (
          <ToolButton tool={extraActive || { id: 'more', label: 'Plus', icon: MoreHorizontal, key: '…' }} active={!!extraActive} onClick={toggle} disabled={readOnly} />
        )}
      >
        {(close) => (
          <div className="flex gap-0.5">
            {EXTRA_TOOLS.map((t) => (
              <ToolButton key={t.id} tool={t} active={tool === t.id} onClick={() => { setTool(t.id); close(); }} />
            ))}
          </div>
        )}
      </Popover>
    </div>
  );
}

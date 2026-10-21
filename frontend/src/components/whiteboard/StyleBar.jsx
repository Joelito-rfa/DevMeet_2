import { Minus, Plus, BringToFront, SendToBack, Copy, Trash2, Bold } from 'lucide-react';
import { cn } from '../../lib/utils';

export const COLORS = ['#111827', '#ef4444', '#2563eb', '#16a34a', '#9333ea', '#f97316', '#eab308', '#db2777', '#0891b2', '#ffffff'];
export const STICKY_COLORS = ['#fde68a', '#fecaca', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fed7aa'];

function Stepper({ label, value, onChange, min, max, step = 1 }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="hidden text-xs text-muted xl:inline">{label}</span>
      <button onClick={() => onChange(Math.max(min, value - step))} className="grid size-7 place-items-center rounded-lg border border-line text-muted hover:bg-hover hover:text-fg"><Minus className="size-3.5" /></button>
      <span className="w-7 text-center text-sm font-medium tabular-nums">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + step))} className="grid size-7 place-items-center rounded-lg border border-line text-muted hover:bg-hover hover:text-fg"><Plus className="size-3.5" /></button>
    </div>
  );
}

const Sep = () => <div className="mx-1 h-6 w-px shrink-0 bg-line" />;

export default function StyleBar({ tool, style, setStyle, selection, onStyleSelection, onLayer, onDuplicate, onDelete }) {
  const hasSelection = selection.length > 0;
  const showSticky = tool === 'sticky' || (hasSelection && selection.every((e) => e.type === 'sticky'));
  const showText = ['text', 'sticky', 'rect', 'ellipse', 'diamond', 'triangle'].includes(tool) || selection.some((e) => ['text', 'sticky'].includes(e.type) || e.text);
  const showFill = ['rect', 'ellipse', 'diamond', 'triangle', 'fill'].includes(tool) || selection.some((e) => ['rect', 'ellipse', 'diamond', 'triangle'].includes(e.type));
  const showStroke = !['text', 'sticky', 'eyedropper', 'hand'].includes(tool) || selection.some((e) => !['text', 'sticky'].includes(e.type));

  const update = (patch, selPatch = patch) => {
    setStyle((s) => ({ ...s, ...patch }));
    if (hasSelection) onStyleSelection(selPatch);
  };

  return (
    <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-line bg-panel px-2.5 py-1.5 shadow-pop">
      {showSticky ? (
        <div className="flex items-center gap-1.5">
          {STICKY_COLORS.map((c) => (
            <button key={c} onClick={() => update({ stickyColor: c }, { fill: c })} className={cn('size-6 shrink-0 rounded-md shadow-sm transition hover:scale-110', style.stickyColor === c && 'ring-2 ring-accent ring-offset-2 ring-offset-panel')} style={{ background: c }} />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              title={c}
              onClick={() => update({ color: c }, { color: c })}
              className={cn('size-6 shrink-0 rounded-md border border-black/10 transition hover:scale-110', style.color === c && 'ring-2 ring-accent ring-offset-2 ring-offset-panel')}
              style={{ background: c }}
            />
          ))}
          <label title="Couleur personnalisée" className="relative grid size-6 shrink-0 cursor-pointer place-items-center rounded-md border border-dashed border-line-strong text-muted hover:text-fg">
            <Plus className="size-3.5" />
            <input type="color" value={style.color} onChange={(e) => update({ color: e.target.value }, { color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        </div>
      )}

      {showFill && (
        <>
          <Sep />
          <div className="flex items-center gap-1 rounded-lg bg-panel-2 p-0.5">
            {[['none', 'Vide'], ['soft', 'Léger'], ['solid', 'Plein']].map(([v, l]) => (
              <button key={v} onClick={() => update({ fillMode: v }, { fillMode: v })} className={cn('h-6 rounded-md px-2 text-xs font-medium', style.fillMode === v ? 'bg-elevated text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg')}>{l}</button>
            ))}
          </div>
        </>
      )}

      {showStroke && (
        <>
          <Sep />
          {tool === 'eraser' ? (
            <Stepper label="Taille gomme" value={style.eraserSize} min={4} max={60} step={4} onChange={(v) => setStyle((s) => ({ ...s, eraserSize: v }))} />
          ) : (
            <Stepper label="Épaisseur" value={style.strokeWidth} min={1} max={24} onChange={(v) => update({ strokeWidth: v }, { strokeWidth: v })} />
          )}
          {tool !== 'eraser' && (
            <button onClick={() => update({ dash: !style.dash }, { dash: !style.dash })} title="Trait pointillé" className={cn('flex h-7 items-center rounded-lg border px-2 text-xs font-medium transition', style.dash ? 'border-accent/50 bg-selected text-accent' : 'border-line text-muted hover:bg-hover hover:text-fg')}>
              <span className="w-7 border-t-2 border-dashed border-current" />
            </button>
          )}
        </>
      )}

      {showText && (
        <>
          <Sep />
          <div className="flex items-center gap-1 rounded-lg bg-panel-2 p-0.5">
            {[['Caveat', 'Manuscrite', 'font-hand text-base'], ['Inter', 'Sans', 'font-sans'], ['mono', 'Mono', 'font-mono']].map(([v, l, cls]) => (
              <button key={v} onClick={() => update({ fontFamily: v }, { fontFamily: v })} className={cn('h-6 rounded-md px-2 text-xs', cls, style.fontFamily === v ? 'bg-elevated text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg')}>{l}</button>
            ))}
          </div>
          <Stepper label="Taille" value={style.fontSize} min={10} max={96} step={2} onChange={(v) => update({ fontSize: v }, { fontSize: v })} />
          {selection.some((e) => e.type === 'text') && (
            <button onClick={() => onStyleSelection({ toggleBold: true })} className="grid size-7 place-items-center rounded-lg border border-line text-muted hover:text-fg" title="Gras"><Bold className="size-3.5" /></button>
          )}
        </>
      )}

      {hasSelection && (
        <>
          <Sep />
          <span className="shrink-0 text-xs text-muted">{selection.length} sélectionné{selection.length > 1 ? 's' : ''}</span>
          <button onClick={() => onLayer('front')} title="Premier plan" className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"><BringToFront className="size-4" /></button>
          <button onClick={() => onLayer('back')} title="Arrière-plan" className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"><SendToBack className="size-4" /></button>
          <button onClick={onDuplicate} title="Dupliquer (Ctrl+D)" className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"><Copy className="size-4" /></button>
          <button onClick={onDelete} title="Supprimer (Suppr)" className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"><Trash2 className="size-4" /></button>
        </>
      )}
    </div>
  );
}

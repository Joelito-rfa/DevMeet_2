import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { pop } from '../../lib/motion';

export function Popover({ trigger, children, side = 'bottom', align = 'end', offset = 8, className, open: controlled, onOpenChange }) {
  const [internal, setInternal] = useState(false);
  const open = controlled ?? internal;
  const setOpen = useCallback((v) => (onOpenChange ? onOpenChange(v) : setInternal(v)), [onOpenChange]);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);

  const place = useCallback(() => {
    const a = anchorRef.current?.getBoundingClientRect();
    const p = panelRef.current;
    if (!a || !p) return;
    const pw = p.offsetWidth;
    const ph = p.offsetHeight;
    let top;
    let left;
    if (side === 'bottom' || side === 'top') {
      top = side === 'bottom' ? a.bottom + offset : a.top - ph - offset;
      if (side === 'bottom' && top + ph > window.innerHeight - 8) top = a.top - ph - offset;
      if (side === 'top' && top < 8) top = a.bottom + offset;
      left = align === 'start' ? a.left : align === 'center' ? a.left + a.width / 2 - pw / 2 : a.right - pw;
    } else {
      left = side === 'right' ? a.right + offset : a.left - pw - offset;
      top = align === 'start' ? a.top : align === 'center' ? a.top + a.height / 2 - ph / 2 : a.bottom - ph;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));
    setPos({ top, left });
  }, [side, align, offset]);

  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!panelRef.current?.contains(e.target) && !anchorRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
    };
  }, [open, place, setOpen]);

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        {trigger({ open, toggle: () => setOpen(!open) })}
      </span>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              {...pop}
              className={cn('fixed z-[60] rounded-xl border border-line bg-elevated shadow-pop', className)}
              style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            >
              {children(() => setOpen(false))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

const menuItemVariants = cva('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition', {
  variants: {
    tone: {
      default: 'text-fg hover:bg-hover',
      danger: 'text-danger hover:bg-danger/10',
    },
    active: { true: '', false: '' },
  },
  compoundVariants: [{ tone: 'default', active: true, className: 'bg-selected text-fg' }],
  defaultVariants: { tone: 'default', active: false },
});

export function MenuItem({ icon: Icon, children, onClick, danger, active, right, className }) {
  return (
    <button onClick={onClick} className={cn(menuItemVariants({ tone: danger ? 'danger' : 'default', active }), className)}>
      {Icon && <Icon className={cn('size-4 shrink-0', !danger && !active && 'text-muted')} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {right}
    </button>
  );
}

export const MenuSeparator = () => <div className="my-1 h-px bg-line" />;
export const MenuLabel = ({ children }) => (
  <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-subtle uppercase">{children}</div>
);

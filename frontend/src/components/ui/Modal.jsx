import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fade, pop } from '../../lib/motion';

export function Modal({ open, onClose, title, description, icon: Icon, children, footer, size = 'md', className }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div {...fade} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            {...pop}
            className={cn(
              'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-panel shadow-pop sm:rounded-2xl',
              widths[size],
              className,
            )}
          >
            {(title || Icon) && (
              <div className="flex items-start gap-3 border-b border-line px-5 py-4">
                {Icon && (
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <Icon className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold">{title}</h2>
                  {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="focus-ring -mt-1 -mr-2 grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"
                  aria-label="Fermer"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-panel-2/50 px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirmer', danger, loading, children }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button className="h-9 rounded-xl px-4 text-sm text-muted hover:bg-hover hover:text-fg" onClick={onClose}>
            Annuler
          </button>
          <button
            disabled={loading}
            onClick={onConfirm}
            className={cn(
              'h-9 rounded-xl px-4 text-sm font-medium text-on-accent disabled:opacity-60',
              danger ? 'bg-danger hover:bg-danger/90' : 'bg-accent hover:bg-accent-hover',
            )}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

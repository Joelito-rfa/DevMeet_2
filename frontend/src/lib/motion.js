// Presets d'animation centralisés (framer-motion).
// Toute animation du design system doit utiliser ces presets.

export const easeOut = [0.22, 1, 0.36, 1];
export const easeSpring = { type: 'spring', stiffness: 380, damping: 28 };
export const springSnappy = { type: 'spring', stiffness: 500, damping: 32 };
export const springSmooth = { type: 'spring', stiffness: 180, damping: 22 };

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.18, ease: easeOut },
};

export const pop = {
  initial: { opacity: 0, scale: 0.96, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 4 },
  transition: { duration: 0.2, ease: easeOut },
};

export const slideUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: { duration: 0.22, ease: easeOut },
};

// Transition de page complexe : slide + blur + fade
export const pageTransition = {
  initial: { opacity: 0, y: 18, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -12, filter: 'blur(6px)' },
  transition: { duration: 0.32, ease: easeOut },
};

// Item de liste avec layout animé (re-tri / filtre fluide)
export const layoutItem = {
  layout: true,
  initial: { opacity: 0, scale: 0.94, y: 14 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.94, y: -8 },
  transition: springSmooth,
};

export const overlayTransition = { duration: 0.18, ease: 'easeOut' };

export const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

export const staggerChild = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: easeOut } },
};

// Stagger lent pour hero / grilles (effet cascade visible)
export const cascadeParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const cascadeChild = {
  hidden: { opacity: 0, y: 18, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: easeOut } },
};

export const typingTransition = { duration: 1.2, repeat: Infinity, ease: 'easeInOut' };

// Flottement organique pour blobs / décorations
export const drift = (dx = 40, dy = 24, duration = 10) => ({
  animate: { x: [0, dx, -dx / 2, 0], y: [0, dy, -dy, 0] },
  transition: { duration, repeat: Infinity, ease: 'easeInOut' },
});

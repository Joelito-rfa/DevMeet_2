// Design tokens centralisés — couleurs, ombres, rayons, espacements.
// Toute couleur / ombre du design system doit venir d'ici (via Tailwind @theme ou ces constantes).

export const palette = {
  accent: 'var(--accent)',
  accent2: 'var(--accent-2)',
  accentSoft: 'var(--accent-soft)',
  bg: 'var(--bg)',
  panel: 'var(--panel)',
  panel2: 'var(--panel-2)',
  elevated: 'var(--elevated)',
  hover: 'var(--hover)',
  line: 'var(--line)',
  lineStrong: 'var(--line-strong)',
  fg: 'var(--text)',
  muted: 'var(--muted)',
  subtle: 'var(--subtle)',
};

export const statusColors = {
  online: 'var(--online)',
  idle: 'var(--idle)',
  dnd: 'var(--dnd)',
  invisible: 'var(--subtle)',
  offline: 'var(--offline)',
};

export const statusLabels = {
  online: 'En ligne',
  idle: 'Absent',
  dnd: 'Ne pas déranger',
  invisible: 'Invisible',
  offline: 'Hors ligne',
};

export const avatarFallback = '#5865f2';

export function roomGradient(color = avatarFallback) {
  return {
    background: `linear-gradient(135deg, ${color}40, ${color}20)`,
    boxShadow: `inset 0 0 0 1px ${color}55`,
  };
}

export function avatarGradient(color = avatarFallback) {
  return { background: `linear-gradient(135deg, ${color}, ${color}bb)` };
}

export const radii = { sm: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.25rem' };

export const shadows = { pop: 'var(--shadow)' };

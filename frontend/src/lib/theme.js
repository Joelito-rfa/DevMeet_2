import { create } from 'zustand';

const read = () => {
  try {
    return localStorage.getItem('devmeet-theme') || 'dark';
  } catch {
    return 'dark';
  }
};

const resolve = (t) => (t === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t);

export const useTheme = create((set) => ({
  theme: read(),
  setTheme(theme) {
    try {
      localStorage.setItem('devmeet-theme', theme);
    } catch {
      /* stockage indisponible */
    }
    document.documentElement.dataset.theme = resolve(theme);
    set({ theme });
  },
}));

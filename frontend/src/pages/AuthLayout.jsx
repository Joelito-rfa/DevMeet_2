import { AnimatePresence, motion } from 'framer-motion';
import { Moon, ShieldCheck, Sparkles, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme';
import { easeOut } from '../lib/motion';
import AuroraBackground from '../components/motion/AuroraBackground';
import AuthGallery from './AuthGallery';

// Bascule clair/sombre accessible avant même de se connecter.
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isLight = theme === 'light';
  return (
    <button
      type="button"
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      aria-label={isLight ? 'Passer au thème sombre' : 'Passer au thème clair'}
      title={isLight ? 'Thème sombre' : 'Thème clair'}
      className="focus-ring absolute top-5 right-5 z-20 grid size-9 place-items-center overflow-hidden rounded-xl border border-line bg-panel/70 text-muted backdrop-blur transition hover:border-line-strong hover:text-fg"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isLight ? 'light' : 'dark'}
          initial={{ y: 14, opacity: 0, rotate: -45 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -14, opacity: 0, rotate: 45 }}
          transition={{ duration: 0.25, ease: easeOut }}
          className="grid place-items-center"
        >
          {isLight ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export default function AuthLayout({ children }) {
  const year = new Date().getFullYear();

  return (
    <div className="relative flex min-h-full overflow-hidden bg-bg">
      <AuroraBackground />
      <ThemeToggle />

      {/* Panneau gauche : galerie de 3 visuels qui défilent */}
      <div className="relative hidden w-[54%] p-4 lg:flex lg:flex-col xl:p-5">
        <div className="relative min-h-[560px] flex-1 overflow-hidden rounded-[30px] bg-[#050812] shadow-pop">
          <AuthGallery />

          {/* En-tête superposé au visuel */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-7 xl:p-9">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl border border-white/15 bg-white/10 backdrop-blur">
                <img src="/logo.svg" alt="" className="size-6" />
              </span>
              <span className="text-lg font-bold tracking-tight text-white">DevMeet</span>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/70 backdrop-blur xl:inline-flex">
              <Sparkles className="size-3.5" /> Aperçu en direct
            </span>
          </div>
        </div>
      </div>

      {/* Panneau droit : formulaire dans une carte en verre */}
      <div className="relative flex flex-1 items-center justify-center px-5 py-12 sm:px-8 lg:px-10">
        <motion.div
          className="relative w-full max-w-[420px]"
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: easeOut }}
        >
          <div className="mb-8 flex flex-col items-center gap-2.5 lg:hidden">
            <img src="/logo.svg" alt="" className="size-12" />
            <span className="text-xl font-bold tracking-tight">DevMeet</span>
          </div>

          <div className="relative overflow-hidden rounded-[26px] border border-line bg-panel/75 p-6 shadow-pop backdrop-blur-xl sm:p-8">
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/80 to-transparent" />
            <span className="pointer-events-none absolute -top-28 left-1/2 size-52 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
            <div className="relative">{children}</div>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-subtle">
            <ShieldCheck className="size-3.5 shrink-0" />© {year} DevMeet · Connexion chiffrée, 100 % navigateur.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

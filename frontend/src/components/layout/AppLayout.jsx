import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { pageTransition } from '../../lib/motion';
import { useRealtime } from '../../hooks/useRealtime';
import { useApp } from '../../store/app';
import { useAuth } from '../../store/auth';
import { VoiceProvider } from '../../voice/VoiceProvider';
import Sidebar from './Sidebar';
import CommandPalette from './CommandPalette';
import { Spinner } from '../ui/Spinner';
import { cn } from '../../lib/utils';

function ConnectionBanner() {
  const connection = useApp((s) => s.connection);
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Petit délai pour éviter un clignotement lors d'une reconnexion instantanée.
    if (connection === 'disconnected') {
      const t = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(t);
    }
    setShow(false);
  }, [connection]);
  if (!show) return null;
  return (
    <div className="animate-slide-up fixed top-3 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-warning/30 bg-warning/15 px-4 py-2 text-sm text-warning shadow-pop backdrop-blur">
      <WifiOff className="size-4" />
      Connexion perdue — reconnexion en cours
      <Spinner className="size-4" />
    </div>
  );
}

function Shell() {
  useRealtime();
  const me = useAuth((s) => s.user);
  useEffect(() => {
    if (me) useApp.getState().mergeUsers([me]);
  }, [me]);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('devmeet-sidebar') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem('devmeet-sidebar', c ? 'open' : 'collapsed');
      return !c;
    });
  };

  return (
    <div className="flex h-full overflow-hidden bg-bg">
      <ConnectionBanner />
      <div
        className={cn('fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition lg:hidden', mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0')}
        onClick={() => setMobileOpen(false)}
      />
      <Sidebar collapsed={collapsed} onToggle={toggle} mobileOpen={mobileOpen} />
      <main className="flex min-w-0 flex-1 flex-col bg-content">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={location.pathname} {...pageTransition} className="flex min-h-0 flex-1 flex-col">
            <Outlet context={{ openSidebar: () => setMobileOpen(true) }} />
          </motion.div>
        </AnimatePresence>
      </main>
      <CommandPalette />
    </div>
  );
}

export default function AppLayout() {
  return (
    <VoiceProvider>
      <Shell />
    </VoiceProvider>
  );
}

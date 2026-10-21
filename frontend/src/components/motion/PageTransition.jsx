import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { pageTransition } from '../../lib/motion';

// Transition complexe entre pages : slide + blur + fade, keyée sur le pathname.
export function PageTransition({ children }) {
  return (
    <motion.div {...pageTransition} className="flex min-h-0 flex-1 flex-col">
      {children}
    </motion.div>
  );
}

// À placer autour de <Outlet/> dans les layouts pour animer chaque changement de route.
export function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={location.pathname} {...pageTransition} className="flex min-h-0 flex-1 flex-col">
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}

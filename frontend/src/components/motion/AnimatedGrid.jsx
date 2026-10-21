import { AnimatePresence, motion } from 'framer-motion';
import { cascadeParent, cascadeChild, layoutItem } from '../../lib/motion';

// Grille animée complexe : cascade à l'entrée + réorganisation fluide (layout)
// + enter/exit animés quand le filtre change.
export function AnimatedGrid({ items, renderItem, keyOf, className = 'grid gap-4 md:grid-cols-2' }) {
  return (
    <motion.div variants={cascadeParent} initial="hidden" animate="show" className={className}>
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((item) => (
          <motion.div key={keyOf(item)} variants={cascadeChild} {...layoutItem}>
            {renderItem(item)}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

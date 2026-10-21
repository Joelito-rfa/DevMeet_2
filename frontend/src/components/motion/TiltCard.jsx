import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

// Carte 3D tilt : suit la souris avec springs, reflet qui se déplace, lift au survol.
export function TiltCard({ children, className = '', max = 8 }) {
  const ref = useRef(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(my, [0, 1], [max, -max]), { stiffness: 250, damping: 20 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-max, max]), { stiffness: 250, damping: 20 });
  const glareX = useTransform(mx, [0, 1], ['-20%', '120%']);

  const onMove = (e) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 900 }}
      className={`relative ${className}`}
    >
      {children}
      <motion.div
        aria-hidden
        style={{ left: glareX }}
        className="pointer-events-none absolute inset-y-0 w-1/3 skew-x-[-12deg] bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />
    </motion.div>
  );
}

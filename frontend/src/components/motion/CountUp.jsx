import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

// Compteur animé complexe : spring physique, se déclenche quand visible.
export function CountUp({ value = 0, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 20 });

  useEffect(() => {
    if (inView) mv.set(Number(value) || 0);
  }, [inView, value, mv]);

  useEffect(() => {
    const unsub = spring.on('change', (v) => {
      if (ref.current) ref.current.textContent = String(Math.round(v));
    });
    return unsub;
  }, [spring]);

  return (
    <span ref={ref} className={className}>
      0
    </span>
  );
}

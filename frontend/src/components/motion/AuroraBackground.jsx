import { motion, useReducedMotion } from 'framer-motion';

// Fond décoratif partagé par les écrans d'authentification :
// dégradé conique qui tourne lentement, trois halos qui dérivent, grille masquée
// et fines particules qui scintillent. Purement visuel (aria-hidden) et
// désactivé si l'utilisateur préfère moins de mouvement.

// Positions pseudo-aléatoires mais stables (pas de Math.random → pas de scintillement au rendu).
const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 41 + 7) % 100}%`,
  top: `${(i * 57 + 11) % 100}%`,
  size: i % 5 === 0 ? 3 : 2,
  delay: (i % 9) * 0.55,
  duration: 6 + (i % 5),
}));

export default function AuroraBackground({ className = '' }) {
  const reduce = useReducedMotion();

  const loop = (duration, animate) =>
    reduce ? {} : { animate, transition: { duration, repeat: Infinity, ease: 'easeInOut' } };

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Balayage conique très lent */}
      <motion.div
        className="absolute -inset-[45%]"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0deg, var(--accent) 55deg, transparent 130deg, var(--accent-2) 205deg, transparent 290deg, var(--accent) 340deg, transparent 360deg)',
          filter: 'blur(90px)',
          opacity: 0.16,
        }}
        {...loop(64, { rotate: 360 })}
      />

      {/* Halos */}
      <motion.div
        className="absolute -top-[28%] -left-[18%] size-[62vw] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, var(--accent), transparent 62%)',
          opacity: 0.24,
          filter: 'blur(70px)',
        }}
        {...loop(24, { x: [0, 70, -20, 0], y: [0, 50, -30, 0], scale: [1, 1.14, 0.94, 1] })}
      />
      <motion.div
        className="absolute top-[18%] -right-[22%] size-[58vw] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, var(--accent-2), transparent 62%)',
          opacity: 0.2,
          filter: 'blur(80px)',
        }}
        {...loop(30, { x: [0, -60, 30, 0], y: [0, -40, 40, 0], scale: [1, 0.92, 1.12, 1] })}
      />
      <motion.div
        className="absolute -bottom-[34%] left-[26%] size-[54vw] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, var(--color-info, #38bdf8), transparent 65%)',
          opacity: 0.14,
          filter: 'blur(90px)',
        }}
        {...loop(27, { x: [0, 40, -40, 0], y: [0, -30, 20, 0] })}
      />

      {/* Grille fine fondue vers les bords */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--line) 1px, transparent 1px), linear-gradient(to bottom, var(--line) 1px, transparent 1px)',
          backgroundSize: '58px 58px',
          maskImage: 'radial-gradient(ellipse 78% 68% at 50% 38%, #000 10%, transparent 72%)',
          WebkitMaskImage: 'radial-gradient(ellipse 78% 68% at 50% 38%, #000 10%, transparent 72%)',
          opacity: 0.5,
        }}
      />

      {/* Particules */}
      {!reduce &&
        PARTICLES.map((p, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-fg"
            style={{ left: p.left, top: p.top, width: p.size, height: p.size }}
            initial={{ opacity: 0.12 }}
            animate={{ opacity: [0.08, 0.55, 0.08], y: [0, -18, 0] }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}

      {/* Vignette pour asseoir la profondeur */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 90% 80% at 50% 40%, transparent 40%, var(--bg) 100%)',
          opacity: 0.55,
        }}
      />
    </div>
  );
}

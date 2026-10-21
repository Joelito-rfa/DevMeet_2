import { useEffect, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { easeOut } from '../lib/motion';

const AUTO_MS = 7000;

// Les trois visuels du panneau gauche. Pour passer à des photos, il suffit de
// remplacer `src` par le chemin d'un fichier déposé dans frontend/public.
const SLIDES = [
  {
    id: 'collab',
    src: '/auth/art-collaboration.svg',
    label: 'Collaboration',
    kicker: 'Temps réel',
    title: 'Concevez ensemble, même à distance.',
    text: 'Un espace unique pour schématiser, discuter et s’entraider — tout se synchronise à la milliseconde.',
  },
  {
    id: 'board',
    src: '/auth/art-whiteboard.svg',
    label: 'Tableau blanc',
    kicker: 'Idéation',
    title: 'Vos idées prennent forme à plusieurs.',
    text: 'Formes, flèches et post-it éditables simultanément, avec les curseurs de chacun en direct.',
  },
  {
    id: 'voice',
    src: '/auth/art-voice.svg',
    label: 'Salons vocaux',
    kicker: 'Discussion',
    title: 'Parlez sans jamais quitter votre espace.',
    text: 'Salons vocaux, messages vocaux et partage de fichiers réunis dans le même salon.',
  },
];

export default function AuthGallery({ className }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = SLIDES[index];
  const [remaining, setRemaining] = useState(AUTO_MS);

  // Rotation automatique : un seul setTimeout reprogrammé à chaque passage.
  // Le temps restant est mémorisé à la pause pour rester synchrone avec la
  // barre de progression, qui reprend exactement où elle s'était figée.
  useEffect(() => {
    if (paused || reduce) return;
    const start = performance.now();
    const id = setTimeout(() => {
      setRemaining(AUTO_MS);
      setIndex((i) => (i + 1) % SLIDES.length);
    }, remaining);
    return () => {
      clearTimeout(id);
      const left = remaining - (performance.now() - start);
      if (left > 0) setRemaining(left);
    };
    // `remaining` est volontairement absent des dépendances : il est relu au
    // redémarrage suivant, après la mise à jour faite par le nettoyage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused, reduce]);

  // Parallaxe douce : le visuel suit légèrement la souris.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const parallaxX = useSpring(useTransform(mx, [-1, 1], [-14, 14]), { stiffness: 110, damping: 24 });
  const parallaxY = useSpring(useTransform(my, [-1, 1], [-10, 10]), { stiffness: 110, damping: 24 });

  const onMove = (e) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
    my.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  const resetParallax = () => {
    mx.set(0);
    my.set(0);
  };

  const go = (i) => setIndex((i + SLIDES.length) % SLIDES.length);

  return (
    <div
      className={cn('relative flex h-full flex-col justify-end overflow-hidden', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        resetParallax();
      }}
      onMouseMove={onMove}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
      data-paused={paused ? 'true' : 'false'}
      role="group"
      aria-roledescription="carrousel"
      aria-label="Aperçu des fonctionnalités DevMeet"
    >
      {/* Couche image : fondu enchaîné + zoom lent (Ken Burns) + parallaxe */}
      <div className="absolute inset-0">
        <motion.div className="absolute -inset-8" style={{ x: parallaxX, y: parallaxY }}>
          <AnimatePresence initial={false}>
            <motion.img
              key={active.id}
              src={active.src}
              alt=""
              aria-hidden
              draggable={false}
              className="absolute inset-0 size-full object-cover"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: reduce ? 1.04 : 1.16 }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 1.1, ease: easeOut },
                scale: { duration: AUTO_MS / 1000 + 3, ease: 'linear' },
              }}
            />
          </AnimatePresence>
        </motion.div>

        {/* Voile pour la lisibilité du texte, indépendant du thème clair/sombre */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(5,8,18,0.95) 0%, rgba(5,8,18,0.76) 32%, rgba(5,8,18,0.24) 64%, rgba(5,8,18,0.5) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 90% 70% at 12% 8%, rgba(5,8,18,0.45), transparent 62%)' }}
        />
        <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-white/10 ring-inset" />
      </div>

      {/* Contenu au-dessus des images */}
      <div className="relative p-7 pt-24 xl:p-10 xl:pt-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            id={`auth-slide-${active.id}`}
            role="tabpanel"
            initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
            transition={{ duration: 0.45, ease: easeOut }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-white/80 uppercase backdrop-blur">
              <span className="size-1.5 rounded-full bg-white/70" />
              {active.kicker}
            </span>
            <h2 className="mt-5 max-w-md text-3xl leading-[1.08] font-extrabold tracking-tight text-white xl:text-[2.7rem]">
              {active.title}
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65 xl:text-base">{active.text}</p>
          </motion.div>
        </AnimatePresence>

        {/* Sélecteur + flèches */}
        <div className="mt-8 flex items-end justify-between gap-6">
          <div role="tablist" aria-label="Choisir un visuel" className="flex flex-col gap-2.5">
            {SLIDES.map((slide, i) => {
              const isActive = i === index;
              return (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`auth-slide-${slide.id}`}
                  onClick={() => go(i)}
                  className="group focus-ring flex items-center gap-3 rounded-full py-0.5 text-left"
                >
                  <span
                    className={cn(
                      'font-mono text-[11px] font-semibold tabular-nums transition-colors duration-300',
                      isActive ? 'text-white' : 'text-white/40 group-hover:text-white/70',
                    )}
                  >
                    0{i + 1}
                  </span>
                  <span
                    className={cn(
                      'h-px transition-all duration-500 ease-out',
                      isActive ? 'w-10 bg-white' : 'w-4 bg-white/30 group-hover:w-6 group-hover:bg-white/60',
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-medium transition-colors duration-300',
                      isActive ? 'text-white' : 'text-white/45 group-hover:text-white/80',
                    )}
                  >
                    {slide.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Visuel précédent"
              className="focus-ring grid size-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white/80 backdrop-blur transition hover:border-white/30 hover:bg-white/20 hover:text-white active:scale-95"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Visuel suivant"
              className="focus-ring grid size-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white/80 backdrop-blur transition hover:border-white/30 hover:bg-white/20 hover:text-white active:scale-95"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Progression du visuel courant (se fige au survol) */}
        <div className="mt-6 h-[3px] overflow-hidden rounded-full bg-white/15">
          <div
            key={active.id}
            className="slide-progress h-full rounded-full bg-gradient-to-r from-white/70 to-white"
            style={{ '--slide-ms': `${AUTO_MS}ms` }}
          />
        </div>
      </div>
    </div>
  );
}

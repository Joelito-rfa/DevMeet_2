import { useEffect, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { Headphones, MessageSquare, PenTool, Flame, CircleCheck, ThumbsUp, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { avatarGradient } from '../lib/tokens';
import { easeOut, springSnappy } from '../lib/motion';

const AUTO_MS = 6500;

// Entrée en cascade d'un élément de scène (rejouée à chaque passage du slide).
const enter = (delay = 0) => ({
  initial: { opacity: 0, y: 12, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.5, ease: easeOut, delay },
});

function Cursor({ name, color, className, dx = 8, duration = 3 }) {
  return (
    <motion.div
      className={className}
      animate={{ x: [0, dx, 0], y: [0, -6, 0] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M3 2l7.5 19 2.6-7.9L21 10.6z" fill={color} stroke="#fff" strokeWidth="1.5" />
      </svg>
      <span className="ml-3 rounded px-1.5 py-0.5 text-[10px] font-semibold text-on-accent" style={{ background: color }}>
        {name}
      </span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Tableau blanc partagé                                            */
/* ------------------------------------------------------------------ */
// La scène déborde de 12 px (bleed) pour absorber la parallaxe et le zoom lent.
function BoardScene() {
  return (
    <div className="board-grid absolute inset-0" style={{ backgroundSize: '18px 18px' }}>
      <div className="absolute inset-3">
        <div className="absolute top-5 left-6 font-hand text-3xl text-board-ink">Idées du projet</div>
        <div className="absolute top-14 left-7 font-hand text-lg leading-snug text-board-muted">
          • Tableau collaboratif
          <br />• Chat en temps réel
          <br />• Salons vocaux
        </div>
        <motion.div
          className="absolute top-5 right-7 rounded-sm bg-idle/25 p-2.5 font-hand text-base text-board-ink shadow-lg ring-1 ring-idle/40"
          animate={{ rotate: [-3, -1.5, -3] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          Démo vendredi
        </motion.div>
        <div className="absolute bottom-6 left-[34%] flex items-center gap-2.5 font-hand text-base">
          <span className="rounded-md border-2 border-success px-2.5 text-board-ink">Idée</span>
          <ArrowRight className="size-4 shrink-0 text-board-muted" />
          <span className="rounded-md border-2 border-accent px-2.5 text-board-ink">Projet</span>
        </div>
        <Cursor name="Alice" color="var(--accent-2)" className="absolute bottom-24 left-[28%]" dx={12} duration={3.2} />
        <Cursor name="Claire" color="var(--color-idle)" className="absolute top-28 right-[26%]" dx={-9} duration={2.7} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Discussion temps réel                                            */
/* ------------------------------------------------------------------ */
function Reaction({ children, delay = 0 }) {
  return (
    <motion.span
      className="absolute -top-2.5 -right-2 rounded-full border border-line bg-elevated px-1.5 py-0.5 text-[10px] shadow-pop"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1, y: [0, -3, 0] }}
      transition={{
        opacity: { duration: 0.25, delay },
        scale: { type: 'spring', stiffness: 420, damping: 18, delay },
        y: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay },
      }}
    >
      {children}
    </motion.span>
  );
}

function ChatScene() {
  return (
    <div className="absolute inset-0 flex flex-col justify-end gap-3 p-8">
      <div className="mb-auto flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-on-accent" style={avatarGradient('#d29922')}>
          CL
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold">#equipe-front</div>
          <div className="flex items-center gap-1.5 text-[10px] text-subtle">
            <span className="size-1.5 rounded-full bg-online" /> 4 en ligne
          </div>
        </div>
      </div>
      <motion.div
        {...enter(0.12)}
        className="relative max-w-[78%] rounded-2xl rounded-tl-md border border-line bg-panel px-3.5 py-2 text-xs text-fg"
      >
        <span className="inline-flex items-center gap-1">
          Maquette du salon mise à jour
          <CircleCheck className="size-3.5 shrink-0 text-success" />
        </span>
        <Reaction delay={0.5}>
          <Flame className="inline size-3 align-[-2px]" /> 2
        </Reaction>
      </motion.div>
      <motion.div
        {...enter(0.28)}
        className="ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-xs text-on-accent shadow-sm"
      >
        <span className="inline-flex items-center gap-1">
          Nickel, je teste les salons vocaux
          <ThumbsUp className="size-3.5 shrink-0" />
        </span>
      </motion.div>
      <motion.div {...enter(0.44)} className="flex w-16 items-center justify-center gap-1 rounded-2xl rounded-bl-md border border-line bg-panel px-3 py-3">
        <span className="typing-dot size-1.5 rounded-full bg-muted" />
        <span className="typing-dot size-1.5 rounded-full bg-muted" />
        <span className="typing-dot size-1.5 rounded-full bg-muted" />
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Salons vocaux                                                    */
/* ------------------------------------------------------------------ */
function Waveform() {
  return (
    <div className="mt-0.5 flex h-3 items-end gap-[3px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          className="h-full w-[3px] origin-bottom rounded-full bg-online"
          animate={{ scaleY: [0.3, 1, 0.45, 0.85, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }}
        />
      ))}
    </div>
  );
}

const PEOPLE = [
  { name: 'Alice', initials: 'AL', color: '#5865f2', speaking: true },
  { name: 'Bob', initials: 'BO', color: '#3fb950' },
  { name: 'Claire', initials: 'CL', color: '#d29922', muted: true },
  { name: 'David', initials: 'DA', color: '#58a6ff' },
];

function VoiceScene() {
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-3.5 p-8">
      <div className="flex items-center gap-2 text-[10px] font-semibold tracking-wide text-subtle uppercase">
        <Headphones className="size-3.5" /> Salon vocal · Design review
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {PEOPLE.map((p, i) => (
          <motion.div
            key={p.name}
            {...enter(0.08 * i)}
            className="flex items-center gap-2.5 rounded-xl border border-line bg-panel px-3 py-2"
          >
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-on-accent',
                p.speaking && 'speaking-ring',
              )}
              style={avatarGradient(p.color)}
            >
              {p.initials}
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-fg">{p.name}</div>
              {p.speaking ? (
                <Waveform />
              ) : (
                <div className="text-[10px] text-subtle">{p.muted ? 'Micro coupé' : 'À l’écoute'}</div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const SLIDES = [
  {
    id: 'board',
    icon: PenTool,
    title: 'Tableau blanc partagé',
    text: 'Formes, flèches et post-it éditables à plusieurs, curseurs en direct.',
    Scene: BoardScene,
  },
  {
    id: 'chat',
    icon: MessageSquare,
    title: 'Discussion temps réel',
    text: 'Accusés de lecture, réactions, fichiers et messages vocaux.',
    Scene: ChatScene,
  },
  {
    id: 'voice',
    icon: Headphones,
    title: 'Salons vocaux',
    text: 'Parlez sans quitter votre espace et voyez qui prend la parole.',
    Scene: VoiceScene,
  },
];

export default function AuthShowcase({ initialIndex = 0 }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), SLIDES.length - 1));
  const [paused, setPaused] = useState(false);
  const active = SLIDES[index];

  // Barre de progression fluide : reflète le temps écoulé, se fige au survol, repart ensuite.
  const progress = useMotionValue(0);
  useEffect(() => {
    progress.set(0);
  }, [index, progress]);

  // Avancement à l'horloge (setTimeout, jamais suspendu) : la rotation reste fiable.
  useEffect(() => {
    if (paused || reduce) return;
    const elapsed = progress.get() * AUTO_MS;
    const id = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), Math.max(AUTO_MS - elapsed, 0));
    return () => clearTimeout(id);
  }, [index, paused, reduce, progress]);

  useEffect(() => {
    if (paused || reduce) return;
    let raf = 0;
    const start = performance.now();
    const elapsed = progress.get() * AUTO_MS;
    const step = (now) => {
      const t = Math.min((elapsed + (now - start)) / AUTO_MS, 1);
      progress.set(t);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [index, paused, reduce, progress]);

  // Parallaxe douce : la scène suit légèrement la souris.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const parallaxX = useSpring(useTransform(mx, [-1, 1], [-6, 6]), { stiffness: 120, damping: 22 });
  const parallaxY = useSpring(useTransform(my, [-1, 1], [-5, 5]), { stiffness: 120, damping: 22 });
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
    my.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };

  const go = (i) => setIndex(i);

  return (
    <div
      className="mt-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        mx.set(0);
        my.set(0);
      }}
      onMouseMove={onMove}
    >
      <div className="relative h-48 overflow-hidden rounded-2xl border border-line bg-panel-2 shadow-pop xl:h-64">
        <AnimatePresence>
          <motion.div
            key={active.id}
            className="absolute -inset-3"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.08, filter: 'blur(8px)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
            transition={{ duration: reduce ? 0 : 0.7, ease: easeOut }}
            style={{ x: parallaxX, y: parallaxY }}
          >
            <motion.div
              className="absolute inset-0"
              animate={reduce ? undefined : { scale: [1, 1.04] }}
              transition={{ duration: 9, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            >
              <active.Scene />
            </motion.div>
          </motion.div>
        </AnimatePresence>
        <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-line/60 ring-inset" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-line/60">
          <motion.div className="h-full origin-left bg-accent" style={{ scaleX: progress }} />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: easeOut }}
            className="flex min-w-0 gap-3"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent ring-1 ring-line">
              <active.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{active.title}</div>
              <div className="text-xs text-muted">{active.text}</div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex shrink-0 items-center gap-2" role="tablist" aria-label="Aperçu des fonctionnalités">
          {SLIDES.map((s, i) => (
            <motion.button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Afficher : ${s.title}`}
              onClick={() => go(i)}
              animate={{ width: i === index ? 26 : 8 }}
              transition={springSnappy}
              className={cn(
                'h-2 cursor-pointer rounded-full transition-colors duration-300',
                i === index ? 'bg-accent' : 'bg-line-strong hover:bg-subtle',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

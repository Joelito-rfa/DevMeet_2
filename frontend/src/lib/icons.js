/**
 * Registre d'icônes UI (lucide-react).
 *
 * Les icônes sont stockées en base sous forme de nom « kebab-case » (ex. `rocket`),
 * ce qui permet de les persister et de les sérialiser côté API sans dépendre
 * du rendu. Ce fichier fait le lien entre ces noms et les composants lucide.
 */
import {
  // Salons
  MessageCircle, Rocket, Lightbulb, Palette, Settings, BookOpen, Handshake, Coffee,
  Brain, Target, FlaskConical, TrendingUp, Wrench, Gamepad2, Globe, Flame, FileText,
  GraduationCap, Puzzle, Headphones, House, Sparkles,
  // Réactions — expressions
  Smile, SmilePlus, Laugh, Angry, Annoyed, Frown, Meh, Drama,
  // Réactions — gestes & symboles
  Heart, HeartCrack, HeartHandshake, HandHeart, Hand, HandFist, HandGrab, HandHelping,
  HandPlatter, HandMetal, HandCoins, HelpingHand, ThumbsUp, ThumbsDown, PartyPopper,
  Eye, CircleCheck, CircleX, TriangleAlert, CircleHelp, CircleAlert, Check, X, Zap,
  Star, Trophy, Award, Medal, Crown, Gift, Bell, Pin, Flag, Quote,
  // Réactions — travail
  Monitor, Laptop, Keyboard, Smartphone, PenLine, StickyNote, Paperclip, ChartColumn,
  ChartLine, Bug, Microscope, TestTube, Dna, Atom, Terminal, Code, Database, Cpu, Pizza,
} from 'lucide-react';

/** Icône utilisée quand aucune icône valide n'est fournie. */
export const DEFAULT_ROOM_ICON = 'message-circle';

/** Icônes proposées lors de la création d'un salon. */
export const ROOM_ICONS = [
  'message-circle', 'rocket', 'lightbulb', 'palette', 'settings', 'book-open',
  'handshake', 'coffee', 'brain', 'target', 'flask-conical', 'trending-up',
  'wrench', 'gamepad-2', 'globe', 'flame', 'file-text', 'graduation-cap',
  'puzzle', 'headphones',
];

/** Libellés affichables des icônes de salon (infobulles, lecteurs d'écran). */
export const ROOM_ICON_LABELS = {
  'message-circle': 'Discussion',
  rocket: 'Projet',
  lightbulb: 'Idée',
  palette: 'Design',
  settings: 'Réglages',
  'book-open': 'Livre',
  handshake: 'Entraide',
  coffee: 'Pause',
  brain: 'Réflexion',
  target: 'Objectif',
  'flask-conical': 'Expérimentation',
  'trending-up': 'Progression',
  wrench: 'Outillage',
  'gamepad-2': 'Loisirs',
  globe: 'International',
  flame: 'Passion',
  'file-text': 'Documents',
  'graduation-cap': 'Études',
  puzzle: 'Énigme',
  headphones: 'Audio',
};

/** Toutes les icônes utilisables, indexées par nom « kebab-case ». */
export const ICONS = {
  // Salons & catégories
  'message-circle': MessageCircle,
  rocket: Rocket,
  lightbulb: Lightbulb,
  palette: Palette,
  settings: Settings,
  'book-open': BookOpen,
  handshake: Handshake,
  coffee: Coffee,
  brain: Brain,
  target: Target,
  'flask-conical': FlaskConical,
  'trending-up': TrendingUp,
  wrench: Wrench,
  'gamepad-2': Gamepad2,
  globe: Globe,
  flame: Flame,
  'file-text': FileText,
  'graduation-cap': GraduationCap,
  puzzle: Puzzle,
  headphones: Headphones,
  house: House,
  sparkles: Sparkles,
  // Expressions
  smile: Smile,
  'smile-plus': SmilePlus,
  laugh: Laugh,
  angry: Angry,
  annoyed: Annoyed,
  frown: Frown,
  meh: Meh,
  drama: Drama,
  // Gestes & symboles
  heart: Heart,
  'heart-crack': HeartCrack,
  'heart-handshake': HeartHandshake,
  'hand-heart': HandHeart,
  hand: Hand,
  'hand-fist': HandFist,
  'hand-grab': HandGrab,
  'hand-helping': HandHelping,
  'hand-platter': HandPlatter,
  'hand-metal': HandMetal,
  'hand-coins': HandCoins,
  'helping-hand': HelpingHand,
  'thumbs-up': ThumbsUp,
  'thumbs-down': ThumbsDown,
  'party-popper': PartyPopper,
  eye: Eye,
  'circle-check': CircleCheck,
  'circle-x': CircleX,
  'triangle-alert': TriangleAlert,
  'circle-help': CircleHelp,
  'circle-alert': CircleAlert,
  check: Check,
  x: X,
  zap: Zap,
  star: Star,
  trophy: Trophy,
  award: Award,
  medal: Medal,
  crown: Crown,
  gift: Gift,
  bell: Bell,
  pin: Pin,
  flag: Flag,
  quote: Quote,
  // Travail
  monitor: Monitor,
  laptop: Laptop,
  keyboard: Keyboard,
  smartphone: Smartphone,
  'pen-line': PenLine,
  'sticky-note': StickyNote,
  paperclip: Paperclip,
  'chart-column': ChartColumn,
  'chart-line': ChartLine,
  bug: Bug,
  microscope: Microscope,
  testtube: TestTube,
  dna: Dna,
  atom: Atom,
  terminal: Terminal,
  code: Code,
  database: Database,
  cpu: Cpu,
  pizza: Pizza,
};

/** Résout un nom d'icône ; retombe sur l'icône par défaut si le nom est inconnu. */
export function getIcon(name) {
  return ICONS[name] || ICONS[DEFAULT_ROOM_ICON];
}

/* ------------------------------------------------------------------ */
/* Réactions de messages                                               */
/* ------------------------------------------------------------------ */

/** Réactions proposées en accès rapide (barre d'actions du message). */
export const QUICK_REACTIONS = ['thumbs-up', 'heart', 'laugh', 'party-popper', 'flame', 'eye'];

/** Catalogue des réactions, organisé par thème. */
export const REACTION_CATEGORIES = {
  Fréquents: [
    'thumbs-up', 'heart', 'laugh', 'party-popper', 'flame', 'eye',
    'circle-check', 'hand-heart', 'zap', 'rocket', 'thumbs-down', 'star',
  ],
  Émotions: [
    'smile', 'smile-plus', 'laugh', 'angry', 'annoyed', 'frown',
    'meh', 'drama', 'heart', 'heart-crack', 'heart-handshake', 'party-popper',
  ],
  Gestes: [
    'thumbs-up', 'thumbs-down', 'hand-heart', 'hand', 'hand-fist', 'hand-grab',
    'hand-helping', 'hand-platter', 'hand-metal', 'hand-coins', 'helping-hand', 'handshake',
  ],
  Travail: [
    'monitor', 'laptop', 'keyboard', 'smartphone', 'book-open', 'file-text',
    'pen-line', 'sticky-note', 'paperclip', 'chart-column', 'chart-line', 'lightbulb',
    'brain', 'target', 'flask-conical', 'bug', 'microscope', 'testtube', 'dna',
    'atom', 'terminal', 'code', 'database', 'cpu',
  ],
  Symboles: [
    'circle-check', 'circle-x', 'triangle-alert', 'circle-help', 'circle-alert',
    'check', 'x', 'zap', 'sparkles', 'star', 'trophy', 'award', 'medal', 'crown',
    'gift', 'bell', 'pin', 'flag', 'quote', 'coffee', 'pizza', 'gamepad-2', 'headphones',
  ],
};

/** Toutes les réactions disponibles sous forme de liste à plat. */
export const REACTION_ICONS = [...new Set(Object.values(REACTION_CATEGORIES).flat())];

/** Libellés affichables des réactions (infobulles, lecteurs d'écran). */
export const REACTION_LABELS = {
  // Fréquents
  'thumbs-up': 'Pouce haut',
  'thumbs-down': 'Pouce bas',
  heart: 'Cœur',
  laugh: 'Rire',
  'party-popper': 'Fête',
  flame: 'Feu',
  eye: 'Regard',
  'circle-check': 'Validé',
  'hand-heart': 'Merci',
  zap: 'Énergie',
  rocket: 'Envo',
  star: 'Favori',
  // Émotions
  smile: 'Sourire',
  'smile-plus': 'Grand sourire',
  angry: 'Colère',
  annoyed: 'Agacement',
  frown: 'Tristesse',
  meh: 'Sans opinion',
  drama: 'Drame',
  'heart-crack': 'Cœur brisé',
  'heart-handshake': 'Amitié',
  // Gestes
  hand: 'Main',
  'hand-fist': 'Poing',
  'hand-grab': 'Attrape',
  'hand-helping': 'Entraide',
  'hand-platter': 'Servi',
  'hand-metal': 'Robot',
  'hand-coins': 'Paiement',
  'helping-hand': 'Coup de main',
  handshake: 'Poignée de main',
  // Travail
  monitor: 'Écran',
  laptop: 'Ordinateur',
  keyboard: 'Clavier',
  smartphone: 'Mobile',
  'file-text': 'Document',
  'pen-line': 'Écriture',
  'sticky-note': 'Pense-bête',
  paperclip: 'Pièce jointe',
  'chart-column': 'Statistiques',
  'chart-line': 'Courbe',
  bug: 'Bug',
  microscope: 'Analyse',
  testtube: 'Test',
  dna: 'Génétique',
  atom: 'Atome',
  terminal: 'Terminal',
  code: 'Code',
  database: 'Base de données',
  cpu: 'Processeur',
  // Symboles
  'circle-x': 'Refusé',
  'triangle-alert': 'Attention',
  'circle-help': 'Question',
  'circle-alert': 'Alerte',
  check: 'OK',
  x: 'Non',
  sparkles: 'Magie',
  trophy: 'Trophée',
  award: 'Récompense',
  medal: 'Médaille',
  crown: 'Champion',
  gift: 'Cadeau',
  bell: 'Notification',
  pin: 'Épinglé',
  flag: 'Signal',
  quote: 'Citation',
  pizza: 'Pizza',
  'gamepad-2': 'Jeux',
  headphones: 'Audio',
};

/** Libellé lisible d'une icône (réactions ou salons). */
export function getIconLabel(name) {
  return REACTION_LABELS[name] || ROOM_ICON_LABELS[name] || name;
}

/** Résout le composant d'une réaction. */
export function getReactionIcon(name) {
  return ICONS[name] || ICONS[DEFAULT_ROOM_ICON];
}

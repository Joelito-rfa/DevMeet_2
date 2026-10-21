import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Layer, Rect, Stage, Transformer } from 'react-konva';
import Konva from 'konva';
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Lock, Unlock, Trash2, Download, History, Hand, Upload, Image as ImageIcon,
  FileJson, FileType2, ClipboardCopy, ChevronDown, Grid3x3,
} from 'lucide-react';
import { toast } from 'sonner';
import { socket, emitAck } from '../../lib/socket';
import { api, saveBlob } from '../../lib/api';
import { useApp } from '../../store/app';
import { useAuth } from '../../store/auth';
import { cn, isTypingTarget, uid } from '../../lib/utils';
import ElementShape, { fontFamily } from './ElementShape';
import Toolbar, { TOOLS, EXTRA_TOOLS } from './Toolbar';
import StyleBar from './StyleBar';
import BoardPreview from './BoardPreview';
import HistoryPanel from './HistoryPanel';
import { BOX_TYPES, CONNECTABLE, arrowPoints, bbox, normalizeRect, rectsIntersect, reduceOps, sortByZ } from './geometry';
import { Popover, MenuItem, MenuLabel, MenuSeparator } from '../ui/Popover';
import { ConfirmModal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';

const DEFAULT_STYLE = {
  color: '#111827',
  stickyColor: '#fde68a',
  fillMode: 'none',
  strokeWidth: 3,
  dash: false,
  fontFamily: 'Caveat',
  fontSize: 28,
  eraserSize: 16,
};
const LIVE_INTERVAL = 45;
const CURSOR_INTERVAL = 35;
const MIN_SCALE = 0.1;
const MAX_SCALE = 6;
const SHAPE_TOOLS = new Set(['rect', 'ellipse', 'diamond', 'triangle']);
const DRAW_TOOLS = new Set(['pencil', 'brush', 'highlighter']);

function hexAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
const fillFor = (color, mode) => (mode === 'solid' ? color : mode === 'soft' ? hexAlpha(color, 0.16) : 'transparent');

function loadStyle() {
  try {
    return { ...DEFAULT_STYLE, ...JSON.parse(localStorage.getItem('devmeet-board-style') || '{}') };
  } catch {
    return DEFAULT_STYLE;
  }
}

/* ---------- Édition de texte en surimpression ---------- */
function TextEditor({ el, view, onCommit }) {
  const ref = useRef(null);
  const [value, setValue] = useState(el.text || '');
  const s = view.scale;
  const isBox = BOX_TYPES.has(el.type);
  const w = (el.width || 0) * (el.scaleX || 1);
  const h = (el.height || 0) * (el.scaleY || 1);

  const ready = useRef(false);
  useLayoutEffect(() => {
    // Focus différé : le mousedown qui suit le pointerdown retirerait sinon le focus.
    const timer = setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
      ready.current = true;
    }, 30);
    return () => clearTimeout(timer);
  }, []);

  useLayoutEffect(() => {
    const t = ref.current;
    if (isBox) return;
    t.style.height = 'auto';
    t.style.height = `${t.scrollHeight}px`;
    t.style.width = 'auto';
    t.style.width = `${Math.max(t.scrollWidth + 8, 60)}px`;
  }, [value, isBox]);

  const pad = el.type === 'sticky' ? 16 : 10;
  const style = {
    position: 'absolute',
    left: el.x * s + view.x,
    top: el.y * s + view.y,
    fontSize: (el.fontSize || 28) * s,
    fontFamily: fontFamily(el.fontFamily),
    fontWeight: el.bold ? 700 : 400,
    lineHeight: 1.15,
    color: el.type === 'text' ? el.fill || '#111827' : el.type === 'sticky' ? '#1f2937' : el.textColor || '#111827',
    transform: `rotate(${el.rotation || 0}deg)`,
    transformOrigin: 'top left',
    background: 'transparent',
    outline: 'none',
    resize: 'none',
    overflow: 'hidden',
    whiteSpace: isBox ? 'pre-wrap' : 'pre',
    padding: isBox ? pad * s : 0,
    textAlign: el.type === 'sticky' || !isBox ? 'left' : 'center',
    ...(isBox ? { width: w * s, height: h * s, display: 'flex' } : { minWidth: 60 }),
  };
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => ready.current && onCommit(value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) ref.current.blur();
      }}
      placeholder={el.type === 'text' ? 'Tapez votre texte…' : ''}
      className="z-20 rounded-sm ring-2 ring-accent/60 placeholder:text-subtle"
      style={style}
    />
  );
}

/* ---------- Curseurs des autres participants ---------- */
function RemoteCursors({ cursors, view }) {
  const users = useApp((s) => s.users);
  return Object.entries(cursors).map(([userId, c]) => {
    const u = users[userId];
    const color = u?.accentColor || '#5865F2';
    return (
      <div
        key={userId}
        className="pointer-events-none absolute top-0 left-0 z-10 transition-transform duration-[60ms] ease-linear"
        style={{ transform: `translate(${c.x * view.scale + view.x}px, ${c.y * view.scale + view.y}px)` }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.35))' }}>
          <path d="M3 2l7.5 19 2.6-7.9L21 10.6z" fill={color} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <span className="absolute top-5 left-4 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-fg shadow-md" style={{ background: color }}>
          {u?.displayName?.split(' ')[0] || '…'}
        </span>
      </div>
    );
  });
}

export default function Whiteboard({ roomId, isAdmin, roomName }) {
  const me = useAuth((s) => s.user);
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const trRef = useRef(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [elements, setElements] = useState({});
  const elRef = useRef({});
  const [loaded, setLoaded] = useState(false);
  const [locked, setLocked] = useState(false);
  const [tool, setToolState] = useState('select');
  const [style, setStyle] = useState(loadStyle);
  const [selected, setSelected] = useState([]);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const viewRef = useRef(view);
  const [cursors, setCursors] = useState({});
  const [editing, setEditing] = useState(null); // { id, isNew, before }
  const [marquee, setMarquee] = useState(null);
  const [spacePan, setSpacePan] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [, setHistoryTick] = useState(0);

  const action = useRef(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const liveQueue = useRef(new Map());
  const liveTimer = useRef(null);
  const lastCursor = useRef(0);
  const clipboard = useRef([]);
  const fitted = useRef(false);

  const readOnly = locked && !isAdmin;
  const panMode = tool === 'hand' || spacePan;
  viewRef.current = view;

  useEffect(() => {
    try {
      localStorage.setItem('devmeet-board-style', JSON.stringify(style));
    } catch {
      /* ignore */
    }
  }, [style]);

  const setTool = useCallback((t) => {
    setToolState(t);
    if (t !== 'select') setSelected([]);
  }, []);

  /* ---------- Taille du conteneur ---------- */
  useLayoutEffect(() => {
    const el = containerRef.current;
    const ro = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------- État & synchronisation ---------- */
  const commit = useCallback((ops) => {
    elRef.current = reduceOps(elRef.current, ops);
    setElements(elRef.current);
  }, []);

  const send = useCallback(
    (ops) => {
      socket.emit('board:op', { roomId, ops }, (res) => {
        if (res?.error) toast.error(res.error);
      });
    },
    [roomId],
  );

  const pushHistory = useCallback((entry) => {
    undoStack.current.push(entry);
    if (undoStack.current.length > 200) undoStack.current.shift();
    redoStack.current = [];
    setHistoryTick((t) => t + 1);
  }, []);

  /** Applique localement, diffuse aux autres et enregistre éventuellement pour annuler. */
  const apply = useCallback(
    (ops, undo) => {
      if (!ops.length) return;
      commit(ops);
      send(ops);
      if (undo) pushHistory({ undo, redo: ops });
    },
    [commit, send, pushHistory],
  );

  const flushLive = useCallback(() => {
    clearTimeout(liveTimer.current);
    liveTimer.current = null;
    if (!liveQueue.current.size) return;
    const ops = [...liveQueue.current.entries()].map(([id, patch]) => ({ t: 'update', id, patch }));
    liveQueue.current.clear();
    send(ops);
  }, [send]);

  /** Mise à jour « en direct » pendant un geste : appliquée localement, diffusée par lots. */
  const live = useCallback(
    (id, patch) => {
      commit([{ t: 'update', id, patch }]);
      liveQueue.current.set(id, { ...(liveQueue.current.get(id) || {}), ...patch });
      if (!liveTimer.current) liveTimer.current = setTimeout(flushLive, LIVE_INTERVAL);
    },
    [commit, flushLive],
  );

  const fitToContent = useCallback(
    (animate = true) => {
      const layer = layerRef.current;
      if (!layer || !size.width) return;
      const list = Object.values(elRef.current);
      if (!list.length) return setView({ x: size.width / 2 - 400, y: size.height / 2 - 250, scale: 1 });
      const b = layer.getClientRect({ relativeTo: layer, skipShadow: true });
      const pad = 60;
      const scale = Math.min(Math.max(Math.min((size.width - pad * 2) / b.width, (size.height - pad * 2) / b.height), MIN_SCALE), 1.4);
      const next = { scale, x: size.width / 2 - (b.x + b.width / 2) * scale, y: size.height / 2 - (b.y + b.height / 2) * scale };
      if (!animate) return setView(next);
      const from = viewRef.current;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min((now - start) / 250, 1);
        const e = 1 - (1 - t) ** 3;
        setView({ x: from.x + (next.x - from.x) * e, y: from.y + (next.y - from.y) * e, scale: from.scale + (next.scale - from.scale) * e });
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    [size.width, size.height],
  );

  useEffect(() => {
    if (loaded && size.width && !fitted.current) {
      fitted.current = true;
      requestAnimationFrame(() => fitToContent(false));
    }
  }, [loaded, size.width, fitToContent]);

  useEffect(() => {
    setLoaded(false);
    fitted.current = false;
    undoStack.current = [];
    redoStack.current = [];
    elRef.current = {};
    setElements({});
    setSelected([]);
    setCursors({});
    setEditing(null);
    setHistoryOpen(false);

    const join = () =>
      emitAck('board:join', { roomId })
        .then(({ elements: list, locked: l }) => {
          commit([{ t: 'replace', elements: list }]);
          setLocked(l);
          setLoaded(true);
        })
        .catch((e) => toast.error(e.message));

    const onOp = ({ roomId: r, ops }) => r === roomId && commit(ops);
    const onReplace = ({ roomId: r, elements: list, by }) => {
      if (r !== roomId) return;
      commit([{ t: 'replace', elements: list }]);
      undoStack.current = [];
      redoStack.current = [];
      setSelected([]);
      setHistoryTick((t) => t + 1);
      if (by !== me.id) toast.info('Le tableau a été restauré par un participant');
    };
    const onCursor = ({ roomId: r, userId, x, y }) => {
      if (r === roomId) setCursors((c) => ({ ...c, [userId]: { x, y, t: Date.now() } }));
    };
    const onCursorLeave = ({ roomId: r, userId }) => {
      if (r === roomId)
        setCursors((c) => {
          const n = { ...c };
          delete n[userId];
          return n;
        });
    };
    const onLocked = ({ roomId: r, locked: l, by }) => {
      if (r !== roomId) return;
      setLocked(l);
      if (by !== me.id) toast.info(l ? 'Le tableau a été verrouillé par un administrateur' : 'Le tableau est de nouveau modifiable');
    };

    join();
    socket.on('connect', join);
    socket.on('board:op', onOp);
    socket.on('board:replace', onReplace);
    socket.on('board:cursor', onCursor);
    socket.on('board:cursor-leave', onCursorLeave);
    socket.on('board:locked', onLocked);
    const prune = setInterval(() => {
      const now = Date.now();
      setCursors((c) => {
        const stale = Object.entries(c).filter(([, v]) => now - v.t > 8000);
        if (!stale.length) return c;
        const n = { ...c };
        stale.forEach(([k]) => delete n[k]);
        return n;
      });
    }, 2000);

    return () => {
      flushLive();
      socket.emit('board:leave', { roomId });
      socket.off('connect', join);
      socket.off('board:op', onOp);
      socket.off('board:replace', onReplace);
      socket.off('board:cursor', onCursor);
      socket.off('board:cursor-leave', onCursorLeave);
      socket.off('board:locked', onLocked);
      clearInterval(prune);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Nettoie la sélection si un élément a été supprimé à distance
  useEffect(() => {
    setSelected((sel) => {
      const next = sel.filter((id) => elements[id]);
      return next.length === sel.length ? sel : next;
    });
    if (editing && !elements[editing.id]) setEditing(null);
  }, [elements, editing]);

  /* ---------- Transformer ---------- */
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const nodes = tool === 'select' && !readOnly ? selected.map((id) => stage.findOne(`#${id}`)).filter(Boolean) : [];
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selected, elements, tool, readOnly]);

  /* ---------- Outils ---------- */
  const nextZ = () => Object.values(elRef.current).reduce((m, e) => Math.max(m, e.z || 0), 0) + 1;

  const elementIdFromNode = (node) => {
    let n = node;
    while (n && n !== stageRef.current) {
      if (n.hasName?.('element')) return n.id();
      n = n.getParent();
    }
    return null;
  };

  const elementAtScreen = (pt) => {
    const shape = stageRef.current.getIntersection(pt);
    return shape ? elementIdFromNode(shape) : null;
  };

  /** Forme « connectable » la plus en avant sous un point (coordonnées monde). */
  const connectableAt = (pos, excludeId) => {
    const candidates = Object.values(elRef.current)
      .filter((el) => el.id !== excludeId && CONNECTABLE.has(el.type))
      .sort((a, b) => (b.z || 0) - (a.z || 0));
    return candidates.find((el) => {
      const b = bbox(el);
      return pos.x >= b.x - 6 && pos.x <= b.x + b.width + 6 && pos.y >= b.y - 6 && pos.y <= b.y + b.height + 6;
    })?.id;
  };

  const eraseAt = () => {
    const stage = stageRef.current;
    const p = stage.getPointerPosition();
    const r = style.eraserSize / 2;
    const pts = [p, ...Array.from({ length: 8 }, (_, i) => ({ x: p.x + Math.cos((i * Math.PI) / 4) * r, y: p.y + Math.sin((i * Math.PI) / 4) * r }))];
    const ids = new Set();
    for (const pt of pts) {
      const id = elementAtScreen(pt);
      if (id && elRef.current[id]) ids.add(id);
    }
    if (!ids.size) return;
    const a = action.current;
    ids.forEach((id) => a.erased.push(elRef.current[id]));
    const ops = [{ t: 'delete', ids: [...ids] }];
    commit(ops);
    send(ops);
  };

  const styleForNew = (type) => {
    const base = { opacity: 1, z: nextZ(), createdBy: me.id };
    if (type === 'sticky') return { ...base, fill: style.stickyColor, fontSize: Math.min(style.fontSize, 32), fontFamily: style.fontFamily };
    if (type === 'text') return { ...base, fill: style.color, fontSize: style.fontSize, fontFamily: style.fontFamily };
    return {
      ...base,
      stroke: style.color,
      strokeWidth: style.strokeWidth,
      dash: style.dash || undefined,
      ...(SHAPE_TOOLS.has(type) ? { fill: fillFor(style.color, style.fillMode), fontSize: Math.min(style.fontSize, 32), fontFamily: style.fontFamily } : {}),
    };
  };

  const create = (el) => {
    const ops = [{ t: 'add', el }];
    commit(ops);
    send(ops);
    return el;
  };

  const onPointerDown = (e) => {
    if (editing) return;
    const stage = stageRef.current;
    if (panMode || e.evt.button === 1) return;
    if (e.evt.button === 2) return;
    const pos = stage.getRelativePointerPosition();
    const targetId = elementIdFromNode(e.target);
    if (readOnly && !['select', 'hand'].includes(tool)) {
      toast.warning('Le tableau est verrouillé par un administrateur');
      return;
    }

    if (tool === 'select') {
      if (!targetId) {
        action.current = { type: 'marquee', start: pos, additive: e.evt.shiftKey, base: e.evt.shiftKey ? selected : [] };
        setMarquee({ x: pos.x, y: pos.y, width: 0, height: 0 });
        if (!e.evt.shiftKey) setSelected([]);
      } else if (e.evt.shiftKey) {
        setSelected((s) => (s.includes(targetId) ? s.filter((x) => x !== targetId) : [...s, targetId]));
      } else if (!selected.includes(targetId)) {
        setSelected([targetId]);
      }
      return;
    }

    if (DRAW_TOOLS.has(tool)) {
      const sw = tool === 'brush' ? style.strokeWidth * 2.5 : tool === 'highlighter' ? Math.max(14, style.strokeWidth * 5) : style.strokeWidth;
      const el = create({
        id: uid(),
        type: 'path',
        tool,
        x: 0,
        y: 0,
        points: [pos.x, pos.y, pos.x + 0.01, pos.y + 0.01],
        ...styleForNew('path'),
        strokeWidth: sw,
        dash: undefined,
        stroke: tool === 'highlighter' ? hexAlpha(style.color === '#111827' ? '#facc15' : style.color, 0.45) : style.color,
      });
      action.current = { type: 'create', id: el.id, start: pos };
      return;
    }

    if (tool === 'line' || tool === 'arrow') {
      const fromId = tool === 'arrow' ? connectableAt(pos) : undefined;
      const el = create({ id: uid(), type: tool, x: 0, y: 0, points: [pos.x, pos.y, pos.x, pos.y], fromId, ...styleForNew(tool) });
      action.current = { type: 'create', id: el.id, start: pos };
      return;
    }

    if (SHAPE_TOOLS.has(tool)) {
      const el = create({ id: uid(), type: tool, x: pos.x, y: pos.y, width: 0, height: 0, ...styleForNew(tool) });
      action.current = { type: 'create', id: el.id, start: pos };
      return;
    }

    if (tool === 'text') {
      const target = targetId && elRef.current[targetId];
      if (target && (target.type === 'text' || target.type === 'sticky' || BOX_TYPES.has(target.type))) {
        setEditing({ id: target.id, isNew: false, before: target.text || '' });
        return;
      }
      const fs = style.fontSize;
      const el = create({ id: uid(), type: 'text', x: pos.x, y: pos.y - fs * 0.6, text: '', ...styleForNew('text') });
      setEditing({ id: el.id, isNew: true, before: '' });
      return;
    }

    if (tool === 'sticky') {
      const el = create({ id: uid(), type: 'sticky', x: pos.x - 100, y: pos.y - 90, width: 200, height: 180, text: '', rotation: Math.round((Math.random() - 0.5) * 4), ...styleForNew('sticky') });
      setEditing({ id: el.id, isNew: true, before: '' });
      setToolState('select');
      return;
    }

    if (tool === 'eraser') {
      action.current = { type: 'erase', erased: [] };
      eraseAt();
      return;
    }

    if (tool === 'fill' && targetId) {
      const el = elRef.current[targetId];
      let patch;
      if (el.type === 'sticky') patch = { fill: style.stickyColor };
      else if (el.type === 'text') patch = { fill: style.color };
      else if (BOX_TYPES.has(el.type)) patch = { fill: fillFor(style.color, style.fillMode === 'none' ? 'soft' : style.fillMode) };
      else patch = { stroke: style.color };
      const before = Object.fromEntries(Object.keys(patch).map((k) => [k, el[k] ?? null]));
      apply([{ t: 'update', id: targetId, patch }], [{ t: 'update', id: targetId, patch: before }]);
      return;
    }

    if (tool === 'eyedropper' && targetId) {
      const el = elRef.current[targetId];
      if (el.type === 'sticky') {
        setStyle((s) => ({ ...s, stickyColor: el.fill }));
      } else {
        const color = el.type === 'text' ? el.fill : el.stroke;
        if (color?.startsWith('#')) setStyle((s) => ({ ...s, color }));
      }
      toast.success('Couleur récupérée');
      setTool('select');
    }
  };

  const onPointerMove = (e) => {
    const shift = !!e?.evt?.shiftKey;
    const stage = stageRef.current;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;
    const now = performance.now();
    if (now - lastCursor.current > CURSOR_INTERVAL) {
      lastCursor.current = now;
      socket.volatile.emit('board:cursor', { roomId, x: Math.round(pos.x), y: Math.round(pos.y) });
    }
    const a = action.current;
    if (!a) return;

    if (a.type === 'create') {
      const el = elRef.current[a.id];
      if (!el) return;
      if (el.type === 'path') {
        const pts = el.points;
        const lx = pts[pts.length - 2];
        const ly = pts[pts.length - 1];
        if (Math.hypot(pos.x - lx, pos.y - ly) * viewRef.current.scale < 1.5) return;
        live(a.id, { points: [...pts, pos.x, pos.y] });
      } else if (el.type === 'line' || el.type === 'arrow') {
        let { x, y } = pos;
        if (shift) {
          const dx = x - a.start.x;
          const dy = y - a.start.y;
          const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(dx, dy);
          x = a.start.x + Math.cos(ang) * len;
          y = a.start.y + Math.sin(ang) * len;
        }
        live(a.id, { points: [a.start.x, a.start.y, x, y] });
      } else {
        let r = normalizeRect(a.start.x, a.start.y, pos.x, pos.y);
        if (shift) {
          const side = Math.max(r.width, r.height);
          r = { x: pos.x < a.start.x ? a.start.x - side : a.start.x, y: pos.y < a.start.y ? a.start.y - side : a.start.y, width: side, height: side };
        }
        live(a.id, r);
      }
    } else if (a.type === 'erase') {
      eraseAt();
    } else if (a.type === 'marquee') {
      setMarquee(normalizeRect(a.start.x, a.start.y, pos.x, pos.y));
    }
  };

  const onPointerUp = () => {
    const a = action.current;
    action.current = null;
    if (!a) return;

    if (a.type === 'create') {
      flushLive();
      let el = elRef.current[a.id];
      if (!el) return;
      const stage = stageRef.current;
      if (BOX_TYPES.has(el.type) && (el.width < 6 || el.height < 6)) {
        const patch = { x: a.start.x - 80, y: a.start.y - 50, width: 160, height: 100 };
        if (el.type === 'ellipse') Object.assign(patch, { x: a.start.x - 60, y: a.start.y - 60, width: 120, height: 120 });
        commit([{ t: 'update', id: el.id, patch }]);
        send([{ t: 'update', id: el.id, patch }]);
      }
      if (el.type === 'line' || el.type === 'arrow') {
        const [x1, y1, x2, y2] = el.points;
        if (Math.hypot(x2 - x1, y2 - y1) < 4) {
          const ops = [{ t: 'delete', ids: [el.id] }];
          commit(ops);
          send(ops);
          return;
        }
        if (el.type === 'arrow') {
          const toId = connectableAt(stage.getRelativePointerPosition(), el.id);
          if (toId && toId !== el.fromId) {
            commit([{ t: 'update', id: el.id, patch: { toId } }]);
            send([{ t: 'update', id: el.id, patch: { toId } }]);
          }
        }
      }
      el = elRef.current[el.id];
      pushHistory({ undo: [{ t: 'delete', ids: [el.id] }], redo: [{ t: 'add', el }] });
      return;
    }

    if (a.type === 'erase' && a.erased.length) {
      pushHistory({ undo: a.erased.map((el) => ({ t: 'add', el })), redo: [{ t: 'delete', ids: a.erased.map((e) => e.id) }] });
      return;
    }

    if (a.type === 'marquee') {
      const m = marquee;
      setMarquee(null);
      if (!m || (m.width < 3 && m.height < 3)) return;
      const layer = layerRef.current;
      const hits = layer
        .find('.element')
        .filter((n) => rectsIntersect(m, n.getClientRect({ relativeTo: layer })))
        .map((n) => n.id());
      setSelected([...new Set([...a.base, ...hits])]);
    }
  };

  // Termine le geste même si le bouton est relâché en dehors du tableau.
  const upRef = useRef(onPointerUp);
  upRef.current = onPointerUp;
  useEffect(() => {
    const onUp = () => action.current && upRef.current();
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, []);

  /* ---------- Déplacement & transformation ---------- */
  const dragStart = useRef(null);

  const handlers = useMemo(
    () => ({
      onDragStart: (e) => {
        const id = e.target.id();
        const ids = selected.includes(id) ? selected : [id];
        if (!selected.includes(id)) setSelected([id]);
        dragStart.current = {
          origin: { x: e.target.x(), y: e.target.y() },
          items: ids.map((i) => ({ id: i, x: elRef.current[i]?.x || 0, y: elRef.current[i]?.y || 0 })).filter((i) => elRef.current[i.id]),
        };
      },
      onDragMove: (e) => {
        const d = dragStart.current;
        if (!d) return;
        const dx = e.target.x() - d.origin.x;
        const dy = e.target.y() - d.origin.y;
        for (const it of d.items) live(it.id, { x: it.x + dx, y: it.y + dy });
      },
      onDragEnd: (e) => {
        const d = dragStart.current;
        dragStart.current = null;
        if (!d) return;
        const dx = e.target.x() - d.origin.x;
        const dy = e.target.y() - d.origin.y;
        for (const it of d.items) live(it.id, { x: it.x + dx, y: it.y + dy });
        flushLive();
        if (dx || dy) {
          pushHistory({
            undo: d.items.map((it) => ({ t: 'update', id: it.id, patch: { x: it.x, y: it.y } })),
            redo: d.items.map((it) => ({ t: 'update', id: it.id, patch: { x: it.x + dx, y: it.y + dy } })),
          });
        }
      },
      onTransformEnd: (e) => {
        const node = e.target;
        const id = node.id();
        const el = elRef.current[id];
        if (!el) return;
        let patch;
        if (BOX_TYPES.has(el.type)) {
          patch = {
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            width: Math.max(10, el.width * node.scaleX()),
            height: Math.max(10, el.height * node.scaleY()),
            scaleX: 1,
            scaleY: 1,
          };
          node.scale({ x: 1, y: 1 });
        } else if (el.type === 'text') {
          patch = { x: node.x(), y: node.y(), rotation: node.rotation(), fontSize: Math.max(8, Math.round((el.fontSize || 28) * node.scaleY())), scaleX: 1, scaleY: 1 };
          node.scale({ x: 1, y: 1 });
        } else {
          patch = { x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() };
        }
        const before = Object.fromEntries(Object.keys(patch).map((k) => [k, el[k] ?? (k.startsWith('scale') ? 1 : 0)]));
        apply([{ t: 'update', id, patch }], [{ t: 'update', id, patch: before }]);
      },
      onDblClick: (e) => {
        const id = e.currentTarget.id();
        const el = elRef.current[id];
        if (readOnly || !el) return;
        if (el.type === 'text' || el.type === 'sticky' || BOX_TYPES.has(el.type)) setEditing({ id, isNew: false, before: el.text || '' });
      },
    }),
    [selected, live, flushLive, pushHistory, apply, readOnly],
  );
  handlers.onDblTap = handlers.onDblClick;

  const commitText = (text) => {
    const ed = editing;
    setEditing(null);
    if (!ed) return;
    const el = elRef.current[ed.id];
    if (!el) return;
    const trimmed = text.replace(/\s+$/, '');
    if (el.type === 'text' && !trimmed.trim()) {
      const ops = [{ t: 'delete', ids: [el.id] }];
      if (ed.isNew) {
        commit(ops);
        send(ops);
      } else apply(ops, [{ t: 'add', el }]);
      return;
    }
    if (ed.isNew) {
      const final = { ...el, text: trimmed };
      commit([{ t: 'update', id: el.id, patch: { text: trimmed } }]);
      send([{ t: 'update', id: el.id, patch: { text: trimmed } }]);
      pushHistory({ undo: [{ t: 'delete', ids: [el.id] }], redo: [{ t: 'add', el: final }] });
      if (tool === 'text') setToolState('select');
    } else if (trimmed !== ed.before) {
      apply([{ t: 'update', id: el.id, patch: { text: trimmed } }], [{ t: 'update', id: el.id, patch: { text: ed.before } }]);
    }
  };

  /* ---------- Actions ---------- */
  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    commit(entry.undo);
    send(entry.undo);
    redoStack.current.push(entry);
    setHistoryTick((t) => t + 1);
  }, [commit, send]);

  const redo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    commit(entry.redo);
    send(entry.redo);
    undoStack.current.push(entry);
    setHistoryTick((t) => t + 1);
  }, [commit, send]);

  const deleteSelected = useCallback(() => {
    const els = selected.map((id) => elRef.current[id]).filter(Boolean);
    if (!els.length || readOnly) return;
    // Supprime aussi les flèches reliées aux formes supprimées
    const ids = new Set(els.map((e) => e.id));
    const linked = Object.values(elRef.current).filter((e) => e.type === 'arrow' && !ids.has(e.id) && (ids.has(e.fromId) || ids.has(e.toId)));
    const all = [...els, ...linked];
    apply([{ t: 'delete', ids: all.map((e) => e.id) }], all.map((el) => ({ t: 'add', el })));
    setSelected([]);
  }, [selected, readOnly, apply]);

  const copySelection = useCallback(() => {
    clipboard.current = selected.map((id) => elRef.current[id]).filter(Boolean).map((e) => structuredClone(e));
    if (clipboard.current.length) toast.success(`${clipboard.current.length} élément(s) copié(s)`);
  }, [selected]);

  const paste = useCallback(
    (source = clipboard.current, offset = 24) => {
      if (!source.length || readOnly) return;
      const idMap = Object.fromEntries(source.map((e) => [e.id, uid()]));
      let z = nextZ();
      const clones = source.map((e) => {
        const c = { ...structuredClone(e), id: idMap[e.id], z: z++, createdBy: me.id };
        if (c.type === 'arrow' && (c.fromId || c.toId)) {
          const bothCopied = (!c.fromId || idMap[c.fromId]) && (!c.toId || idMap[c.toId]);
          if (bothCopied) {
            c.fromId = c.fromId && idMap[c.fromId];
            c.toId = c.toId && idMap[c.toId];
          } else {
            c.points = arrowPoints(e, elRef.current);
            delete c.fromId;
            delete c.toId;
          }
        }
        c.x = (c.x || 0) + offset;
        c.y = (c.y || 0) + offset;
        return c;
      });
      apply(clones.map((el) => ({ t: 'add', el })), [{ t: 'delete', ids: clones.map((c) => c.id) }]);
      setSelected(clones.map((c) => c.id));
      clipboard.current = clones;
      setToolState('select');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readOnly, apply, me.id],
  );

  const duplicate = useCallback(() => paste(selected.map((id) => elRef.current[id]).filter(Boolean)), [paste, selected]);

  const layerOrder = (dir) => {
    const all = Object.values(elRef.current);
    const zs = all.map((e) => e.z || 0);
    let z = dir === 'front' ? Math.max(...zs) + 1 : Math.min(...zs) - selected.length;
    const ops = [];
    const undoOps = [];
    for (const id of selected) {
      const el = elRef.current[id];
      if (!el) continue;
      ops.push({ t: 'update', id, patch: { z: z++ } });
      undoOps.push({ t: 'update', id, patch: { z: el.z || 0 } });
    }
    apply(ops, undoOps);
  };

  const styleSelection = (patch) => {
    const ops = [];
    const undoOps = [];
    for (const id of selected) {
      const el = elRef.current[id];
      if (!el) continue;
      const p = {};
      if (patch.color) {
        if (el.type === 'text') p.fill = patch.color;
        else if (el.type !== 'sticky') {
          p.stroke = el.tool === 'highlighter' ? hexAlpha(patch.color, 0.45) : patch.color;
          if (BOX_TYPES.has(el.type) && el.fill && el.fill !== 'transparent') p.fill = fillFor(patch.color, style.fillMode === 'none' ? 'soft' : style.fillMode);
        }
      }
      if (patch.fill && el.type === 'sticky') p.fill = patch.fill;
      if (patch.fillMode && BOX_TYPES.has(el.type) && el.type !== 'sticky') p.fill = fillFor(el.stroke || style.color, patch.fillMode);
      if (patch.strokeWidth && !['text', 'sticky'].includes(el.type)) p.strokeWidth = patch.strokeWidth;
      if ('dash' in patch && !['text', 'sticky', 'path'].includes(el.type)) p.dash = patch.dash || null;
      if (patch.fontFamily && (el.type === 'text' || el.type === 'sticky' || BOX_TYPES.has(el.type))) p.fontFamily = patch.fontFamily;
      if (patch.fontSize && (el.type === 'text' || el.type === 'sticky' || BOX_TYPES.has(el.type))) p.fontSize = patch.fontSize;
      if (patch.toggleBold && el.type === 'text') p.bold = !el.bold;
      if (!Object.keys(p).length) continue;
      ops.push({ t: 'update', id, patch: p });
      undoOps.push({ t: 'update', id, patch: Object.fromEntries(Object.keys(p).map((k) => [k, el[k] ?? null])) });
    }
    apply(ops, undoOps);
  };

  const clearBoard = () => {
    const all = Object.values(elRef.current);
    apply([{ t: 'clear' }], all.map((el) => ({ t: 'add', el })));
    setSelected([]);
    setConfirmClear(false);
    toast.success('Tableau effacé (une version a été sauvegardée dans l’historique)');
  };

  const toggleLock = async () => {
    try {
      await emitAck('board:lock', { roomId, locked: !locked });
      setLocked(!locked);
      toast.success(!locked ? 'Tableau verrouillé : seuls les admins peuvent modifier' : 'Tableau déverrouillé');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const zoomBy = useCallback(
    (factor, center) => {
      setView((v) => {
        const c = center || { x: size.width / 2, y: size.height / 2 };
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
        const wx = (c.x - v.x) / v.scale;
        const wy = (c.y - v.y) / v.scale;
        return { scale, x: c.x - wx * scale, y: c.y - wy * scale };
      });
    },
    [size.width, size.height],
  );

  const onWheel = (e) => {
    e.evt.preventDefault();
    if (e.evt.ctrlKey || e.evt.metaKey) {
      zoomBy(Math.exp(-e.evt.deltaY * 0.0022), stageRef.current.getPointerPosition());
    } else {
      setView((v) => ({ ...v, x: v.x - e.evt.deltaX, y: v.y - e.evt.deltaY }));
    }
  };

  /* ---------- Export ---------- */
  const renderCanvas = (pixelRatio = 2) => {
    const stage = stageRef.current;
    const layer = layerRef.current;
    if (!Object.keys(elRef.current).length) {
      toast.info('Le tableau est vide');
      return null;
    }
    trRef.current?.nodes([]);
    const saved = { x: stage.x(), y: stage.y(), s: stage.scaleX() };
    stage.position({ x: 0, y: 0 });
    stage.scale({ x: 1, y: 1 });
    const b = layer.getClientRect({ relativeTo: stage });
    const pad = 40;
    const src = layer.toCanvas({ x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2, pixelRatio });
    stage.position({ x: saved.x, y: saved.y });
    stage.scale({ x: saved.s, y: saved.s });
    stage.batchDraw();
    setSelected((s) => [...s]);
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);
    return out;
  };

  const baseName = `devmeet-${(roomName || 'tableau').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;

  const exportAs = async (format) => {
    if (format === 'json') {
      const data = { app: 'DevMeet', version: 1, room: roomName, exportedAt: new Date().toISOString(), elements: Object.values(elRef.current) };
      saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${baseName}.json`);
      return toast.success('Tableau exporté en JSON');
    }
    const canvas = renderCanvas(format === 'pdf' ? 2 : 2);
    if (!canvas) return;
    if (format === 'png' || format === 'jpeg') {
      canvas.toBlob((blob) => saveBlob(blob, `${baseName}.${format === 'png' ? 'png' : 'jpg'}`), `image/${format}`, 0.92);
      toast.success(`Tableau exporté en ${format.toUpperCase()}`);
    } else if (format === 'pdf') {
      const w = canvas.width / 2;
      const h = canvas.height / 2;
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h + 40], hotfixes: ['px_scaling'] });
      pdf.setFontSize(12);
      pdf.setTextColor(100);
      pdf.text(`${roomName || 'Tableau'} — DevMeet — ${new Date().toLocaleString('fr-FR')}`, 16, 24);
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 40, w, h);
      pdf.save(`${baseName}.pdf`);
      toast.success('Tableau exporté en PDF');
    } else if (format === 'clipboard') {
      canvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          toast.success('Image copiée dans le presse-papiers');
        } catch {
          toast.error('Copie non supportée par ce navigateur');
        }
      });
    }
  };

  const importJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const list = Array.isArray(data) ? data : data.elements;
        if (!Array.isArray(list)) throw new Error('Fichier invalide');
        await api.post(`/rooms/${roomId}/board/import`, { elements: list });
        toast.success(`${list.length} élément(s) importé(s)`);
        setTimeout(() => fitToContent(), 100);
      } catch (e) {
        toast.error(e.message || 'Import impossible');
      }
    };
    input.click();
  };

  /* ---------- Clavier ---------- */
  useEffect(() => {
    const all = [...TOOLS, ...EXTRA_TOOLS];
    const onKey = (e) => {
      if (isTypingTarget(e.target) || editing) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpacePan(true);
        return;
      }
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); if (!readOnly) undo(); return; }
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); if (!readOnly) redo(); return; }
      if (mod && k === 'c') { copySelection(); return; }
      if (mod && k === 'v') { if (clipboard.current.length) { e.preventDefault(); paste(); } return; }
      if (mod && k === 'd') { e.preventDefault(); duplicate(); return; }
      if (mod && k === 'a') { e.preventDefault(); setToolState('select'); setSelected(Object.keys(elRef.current)); return; }
      if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoomBy(1.2); return; }
      if (mod && k === '-') { e.preventDefault(); zoomBy(1 / 1.2); return; }
      if (e.shiftKey && e.code === 'Digit1') { fitToContent(); return; }
      if (k === 'delete' || k === 'backspace') { deleteSelected(); return; }
      if (k === 'escape') { setSelected([]); setToolState('select'); return; }
      if (mod || e.altKey) return;
      const t = all.find((x) => x.key.toLowerCase() === k);
      if (t && (!readOnly || ['select', 'hand'].includes(t.id))) setTool(t.id);
    };
    const onKeyUp = (e) => e.code === 'Space' && setSpacePan(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [editing, readOnly, undo, redo, copySelection, paste, duplicate, deleteSelected, zoomBy, fitToContent, setTool]);

  /* ---------- Rendu ---------- */
  const sorted = useMemo(() => sortByZ(Object.values(elements)), [elements]);
  const selection = useMemo(() => selected.map((id) => elements[id]).filter(Boolean), [selected, elements]);
  const viewport = useMemo(
    () => ({ x: -view.x / view.scale, y: -view.y / view.scale, width: size.width / view.scale, height: size.height / view.scale }),
    [view, size],
  );

  const cursor = panMode
    ? 'grab'
    : tool === 'select'
      ? 'default'
      : tool === 'text'
        ? 'text'
        : tool === 'eraser'
          ? `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${style.eraserSize + 4}' height='${style.eraserSize + 4}'><circle cx='${style.eraserSize / 2 + 2}' cy='${style.eraserSize / 2 + 2}' r='${style.eraserSize / 2}' fill='white' fill-opacity='.6' stroke='%23111827' stroke-width='1.5'/></svg>") ${style.eraserSize / 2 + 2} ${style.eraserSize / 2 + 2}, crosshair`
          : tool === 'fill' || tool === 'eyedropper'
            ? 'copy'
            : 'crosshair';

  const grid = 24 * view.scale;
  const editingEl = editing && elements[editing.id];

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-col gap-2">
        <Toolbar tool={tool} setTool={setTool} readOnly={readOnly} />
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <StyleBar
              tool={tool}
              style={style}
              setStyle={setStyle}
              selection={selection}
              onStyleSelection={styleSelection}
              onLayer={layerOrder}
              onDuplicate={duplicate}
              onDelete={deleteSelected}
            />
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-line shadow-pop">
        <div
          ref={containerRef}
          className={cn('absolute inset-0', showGrid ? 'board-grid' : 'bg-board')}
          style={{ backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${view.x}px ${view.y}px`, cursor }}
        >
          {size.width > 0 && (
            <Stage
              ref={stageRef}
              width={size.width}
              height={size.height}
              x={view.x}
              y={view.y}
              scaleX={view.scale}
              scaleY={view.scale}
              draggable={panMode}
              onDragMove={(e) => e.target === stageRef.current && setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }))}
              onDragEnd={(e) => e.target === stageRef.current && setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }))}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onWheel={onWheel}
              onContextMenu={(e) => e.evt.preventDefault()}
              style={{ touchAction: 'none' }}
            >
              <Layer ref={layerRef}>
                {sorted.map((el) => (
                  <ElementShape
                    key={el.id}
                    el={el}
                    elements={el.type === 'arrow' && (el.fromId || el.toId) ? elements : undefined}
                    draggable={tool === 'select' && !readOnly && !panMode}
                    interactive
                    editing={editing?.id === el.id}
                    handlers={handlers}
                  />
                ))}
              </Layer>
              <Layer>
                <Transformer
                  ref={trRef}
                  rotateEnabled
                  keepRatio={false}
                  flipEnabled={false}
                  borderStroke="#5865F2"
                  anchorStroke="#5865F2"
                  anchorFill="#ffffff"
                  anchorSize={9}
                  anchorCornerRadius={3}
                  padding={4}
                  boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8 ? oldBox : newBox)}
                />
                {marquee && (
                  <Rect {...marquee} fill="rgba(88,101,242,0.10)" stroke="#5865F2" strokeWidth={1 / view.scale} dash={[4 / view.scale, 4 / view.scale]} listening={false} />
                )}
              </Layer>
            </Stage>
          )}
          <RemoteCursors cursors={cursors} view={view} />
          {editingEl && <TextEditor key={editingEl.id} el={editingEl} view={view} onCommit={commitText} />}
        </div>

        {!loaded && (
          <div className="absolute inset-0 grid place-items-center bg-board/80">
            <Spinner className="text-subtle" />
          </div>
        )}

        {loaded && !sorted.length && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center text-subtle">
              <p className="font-hand text-4xl">Tableau vide — à vous de jouer !</p>
              <p className="mt-2 text-sm">Choisissez un outil ci-dessus, ou appuyez sur <b>P</b> pour dessiner, <b>N</b> pour un post-it.</p>
            </div>
          </div>
        )}

        {locked && (
          <div className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-panel px-3 py-1.5 text-xs font-medium text-fg shadow-lg backdrop-blur">
            <Lock className="size-3.5" /> {isAdmin ? 'Tableau verrouillé (vous pouvez modifier)' : 'Tableau en lecture seule'}
          </div>
        )}

        {/* Barre verticale gauche : annuler, zoom */}
        <div className="absolute top-3 left-3 z-20 flex flex-col items-center gap-0.5 rounded-xl border border-line bg-elevated/95 p-1 text-muted shadow-lg backdrop-blur">
          {[
            { icon: Undo2, label: 'Annuler', sub: 'Ctrl+Z', onClick: undo, disabled: readOnly || !undoStack.current.length },
            { icon: Redo2, label: 'Rétablir', sub: 'Ctrl+Y', onClick: redo, disabled: readOnly || !redoStack.current.length },
          ].map((b) => (
            <button key={b.label} onClick={b.onClick} disabled={b.disabled} title={`${b.label} (${b.sub})`} className="flex w-9 flex-col items-center rounded-lg py-1.5 text-[10px] hover:bg-hover disabled:opacity-35 md:w-12">
              <b.icon className="size-4" />
              <span className="max-md:hidden">{b.label}</span>
            </button>
          ))}
          <div className="my-0.5 h-px w-8 bg-line" />
          <button onClick={() => zoomBy(1.2)} title="Zoom avant" className="flex w-9 flex-col items-center rounded-lg py-1.5 text-[10px] hover:bg-hover md:w-12"><ZoomIn className="size-4" /><span className="max-md:hidden">Zoom +</span></button>
          <button onClick={() => zoomBy(1 / 1.2)} title="Zoom arrière" className="flex w-9 flex-col items-center rounded-lg py-1.5 text-[10px] hover:bg-hover md:w-12"><ZoomOut className="size-4" /><span className="max-md:hidden">Zoom −</span></button>
          <button onClick={() => setView((v) => ({ ...v, scale: 1 }))} className="w-9 rounded-md border border-line py-0.5 text-[10px] font-semibold tabular-nums hover:bg-hover md:w-12 md:text-[11px]" title="Réinitialiser le zoom">
            {Math.round(view.scale * 100)}%
          </button>
          <button onClick={() => fitToContent()} title="Ajuster (Maj+1)" className="flex w-9 flex-col items-center rounded-lg py-1.5 text-[10px] hover:bg-hover md:w-12"><Maximize className="size-4" /><span className="max-md:hidden">Ajuster</span></button>
          <button onClick={() => setShowGrid((g) => !g)} title="Grille" className={cn('flex w-9 flex-col items-center rounded-lg py-1.5 text-[10px] hover:bg-hover md:w-12', showGrid && 'text-accent')}><Grid3x3 className="size-4" /><span className="max-md:hidden">Grille</span></button>
        </div>

        {/* Minimap */}
        {showMinimap && loaded && size.width > 640 && (
          <div className="absolute bottom-3 left-3 z-20 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
            <BoardPreview
              elements={elements}
              width={190}
              height={115}
              viewport={viewport}
              padding={8}
              onNavigate={(p) => setView((v) => ({ ...v, x: size.width / 2 - p.x * v.scale, y: size.height / 2 - p.y * v.scale }))}
            />
          </div>
        )}

        {/* Barre d'actions basse */}
        <div className="absolute right-3 bottom-3 z-20 flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-0.5 rounded-xl border border-line bg-elevated/95 p-1 text-muted shadow-lg backdrop-blur">
            <button onClick={() => setTool(tool === 'hand' ? 'select' : 'hand')} title="Main (H / Espace)" className={cn('grid size-8 place-items-center rounded-lg hover:bg-hover', panMode && 'bg-selected text-accent')}><Hand className="size-4" /></button>
            {isAdmin && (
              <button onClick={toggleLock} title={locked ? 'Déverrouiller le tableau' : 'Verrouiller le tableau'} className={cn('grid size-8 place-items-center rounded-lg hover:bg-hover', locked && 'bg-warning/10 text-warning')}>
                {locked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
              </button>
            )}
            <button onClick={() => setHistoryOpen((h) => !h)} title="Historique des versions" className={cn('grid size-8 place-items-center rounded-lg hover:bg-hover', historyOpen && 'bg-selected text-accent')}><History className="size-4" /></button>
            <button onClick={() => setShowMinimap((m) => !m)} title="Mini-carte" className={cn('hidden size-8 place-items-center rounded-lg hover:bg-hover md:grid', showMinimap && 'text-accent')}>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><rect x="12" y="11" width="6" height="5" rx="1" /></svg>
            </button>
          </div>
          {!readOnly && (
            <button onClick={() => setConfirmClear(true)} className="flex h-10 items-center gap-2 rounded-xl border border-danger/30 bg-elevated/95 px-3 text-sm font-medium text-danger shadow-lg backdrop-blur hover:bg-danger/10">
              <Trash2 className="size-4" /> <span className="hidden sm:inline">Effacer le tableau</span>
            </button>
          )}
          <Popover
            side="top"
            align="end"
            className="w-64 p-1.5"
            trigger={({ toggle }) => (
              <button onClick={toggle} className="flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-on-accent shadow-sm transition hover:bg-accent-hover">
                <Download className="size-4" /> Exporter <ChevronDown className="size-4" />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuLabel>Image</MenuLabel>
                <MenuItem icon={ImageIcon} onClick={() => { close(); exportAs('png'); }} right={<span className="text-[10px] text-subtle">.PNG</span>}>Image PNG (haute qualité)</MenuItem>
                <MenuItem icon={ImageIcon} onClick={() => { close(); exportAs('jpeg'); }} right={<span className="text-[10px] text-subtle">.JPG</span>}>Image JPEG</MenuItem>
                <MenuItem icon={FileType2} onClick={() => { close(); exportAs('pdf'); }} right={<span className="text-[10px] text-subtle">.PDF</span>}>Document PDF</MenuItem>
                <MenuItem icon={ClipboardCopy} onClick={() => { close(); exportAs('clipboard'); }}>Copier l’image</MenuItem>
                <MenuSeparator />
                <MenuLabel>Données</MenuLabel>
                <MenuItem icon={FileJson} onClick={() => { close(); exportAs('json'); }} right={<span className="text-[10px] text-subtle">.JSON</span>}>Exporter (ré-importable)</MenuItem>
                {!readOnly && <MenuItem icon={Upload} onClick={() => { close(); importJson(); }}>Importer un fichier JSON</MenuItem>}
              </>
            )}
          </Popover>
        </div>

        {historyOpen && <HistoryPanel roomId={roomId} onClose={() => setHistoryOpen(false)} readOnly={readOnly} />}
      </div>

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearBoard}
        danger
        title="Effacer tout le tableau ?"
        description="Le contenu sera effacé pour tous les participants. Une version est automatiquement sauvegardée dans l’historique et l’action peut être annulée (Ctrl+Z)."
        confirmLabel="Effacer le tableau"
      />
    </div>
  );
}

// Konva : meilleure netteté sur écrans haute densité
Konva.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

export const BOX_TYPES = new Set(['rect', 'ellipse', 'diamond', 'triangle', 'sticky']);
export const CONNECTABLE = new Set(['rect', 'ellipse', 'diamond', 'triangle', 'sticky', 'text']);
export const LINE_TYPES = new Set(['line', 'arrow', 'path']);

/** Applique une liste d'opérations à un dictionnaire d'éléments (immutabilité superficielle). */
export function reduceOps(state, ops) {
  let next = state;
  const copy = () => {
    if (next === state) next = { ...state };
  };
  for (const op of ops) {
    if (op.t === 'add') {
      copy();
      next[op.el.id] = op.el;
    } else if (op.t === 'update') {
      const cur = next[op.id];
      if (cur) {
        copy();
        next[op.id] = { ...cur, ...op.patch };
      }
    } else if (op.t === 'delete') {
      copy();
      for (const id of op.ids) delete next[id];
    } else if (op.t === 'clear') {
      next = {};
    } else if (op.t === 'replace') {
      next = Object.fromEntries(op.elements.map((e) => [e.id, e]));
    }
  }
  return next;
}

/** Boîte englobante approximative (coordonnées monde), utilisée pour les connecteurs. */
export function bbox(el, textSize) {
  if (BOX_TYPES.has(el.type)) {
    return { x: el.x, y: el.y, width: el.width * (el.scaleX || 1), height: el.height * (el.scaleY || 1) };
  }
  if (el.type === 'text') {
    const s = textSize?.[el.id];
    if (s) return { x: el.x, y: el.y, width: s.width, height: s.height };
    const lines = (el.text || '').split('\n');
    const w = Math.max(...lines.map((l) => l.length), 1) * (el.fontSize || 24) * 0.5;
    return { x: el.x, y: el.y, width: w, height: lines.length * (el.fontSize || 24) * 1.2 };
  }
  const pts = el.points || [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    minX = Math.min(minX, pts[i]);
    maxX = Math.max(maxX, pts[i]);
    minY = Math.min(minY, pts[i + 1]);
    maxY = Math.max(maxY, pts[i + 1]);
  }
  if (!Number.isFinite(minX)) return { x: el.x || 0, y: el.y || 0, width: 0, height: 0 };
  return { x: minX + (el.x || 0), y: minY + (el.y || 0), width: maxX - minX, height: maxY - minY };
}

const center = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/** Point d'intersection entre le bord d'une boîte et le segment centre → cible. */
function edgePoint(b, target, pad = 6) {
  const c = center(b);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (!dx && !dy) return c;
  const hw = b.width / 2 + pad;
  const hh = b.height / 2 + pad;
  const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/** Calcule les points d'une flèche, en suivant les formes auxquelles elle est reliée. */
export function arrowPoints(el, elements, textSize) {
  const pts = el.points || [0, 0, 0, 0];
  const ox = el.x || 0;
  const oy = el.y || 0;
  const from = el.fromId && elements[el.fromId];
  const to = el.toId && elements[el.toId];
  if (!from && !to) return pts;
  const start = { x: pts[0] + ox, y: pts[1] + oy };
  const end = { x: pts[pts.length - 2] + ox, y: pts[pts.length - 1] + oy };
  const fb = from && bbox(from, textSize);
  const tb = to && bbox(to, textSize);
  const a = fb ? edgePoint(fb, tb ? center(tb) : end) : start;
  const b = tb ? edgePoint(tb, fb ? center(fb) : start) : end;
  return [a.x - ox, a.y - oy, b.x - ox, b.y - oy];
}

export function rectsIntersect(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function normalizeRect(x1, y1, x2, y2) {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

export const sortByZ = (list) => list.sort((a, b) => (a.z || 0) - (b.z || 0));

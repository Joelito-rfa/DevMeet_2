import { query, one } from '../db/pool.js';

/**
 * État des tableaux blancs gardé en mémoire pour une synchronisation instantanée,
 * persisté en base de façon différée (debounce) et versionné régulièrement.
 */
const boards = new Map();
const loading = new Map();

const SAVE_DELAY_MS = 1200;
const AUTO_VERSION_MS = 10 * 60 * 1000;
const MAX_ELEMENTS = 5000;
const MAX_ELEMENT_BYTES = 200_000;
const MAX_VERSIONS = 60;
const TYPES = new Set(['path', 'line', 'arrow', 'rect', 'ellipse', 'diamond', 'triangle', 'text', 'sticky']);
const ID_RE = /^[\w-]{1,40}$/;

export async function loadBoard(roomId) {
  if (boards.has(roomId)) return boards.get(roomId);
  if (loading.has(roomId)) return loading.get(roomId);
  const promise = (async () => {
    const row = await one('SELECT data, locked FROM whiteboards WHERE room_id = ?', [roomId]);
    let list = [];
    try {
      list = row ? JSON.parse(row.data) : [];
    } catch {
      list = [];
    }
    const board = {
      roomId,
      elements: new Map(list.filter((e) => e?.id).map((e) => [e.id, e])),
      locked: !!row?.locked,
      saveTimer: null,
      changes: 0,
      lastVersionAt: Date.now(),
      lastUserId: null,
    };
    boards.set(roomId, board);
    loading.delete(roomId);
    return board;
  })();
  loading.set(roomId, promise);
  return promise;
}

export const elementsOf = (board) => [...board.elements.values()];

function sanitizeElement(el) {
  if (!el || typeof el !== 'object' || !ID_RE.test(el.id) || !TYPES.has(el.type)) return null;
  if (JSON.stringify(el).length > MAX_ELEMENT_BYTES) return null;
  return el;
}

function sanitizePatch(patch) {
  if (!patch || typeof patch !== 'object') return null;
  const { id: _id, type: _type, ...rest } = patch;
  if (JSON.stringify(rest).length > MAX_ELEMENT_BYTES) return null;
  return rest;
}

/** Applique une liste d'opérations et retourne celles qui ont été acceptées. */
export function applyOps(board, ops, userId) {
  const applied = [];
  for (const op of Array.isArray(ops) ? ops.slice(0, 500) : []) {
    switch (op?.t) {
      case 'add': {
        const el = sanitizeElement(op.el);
        if (!el || board.elements.size >= MAX_ELEMENTS) break;
        board.elements.set(el.id, el);
        applied.push({ t: 'add', el });
        break;
      }
      case 'update': {
        const existing = board.elements.get(op.id);
        const patch = sanitizePatch(op.patch);
        if (!existing || !patch) break;
        Object.assign(existing, patch);
        applied.push({ t: 'update', id: op.id, patch });
        break;
      }
      case 'delete': {
        const ids = (Array.isArray(op.ids) ? op.ids : []).filter((id) => board.elements.delete(id));
        if (ids.length) applied.push({ t: 'delete', ids });
        break;
      }
      case 'clear': {
        if (board.elements.size) {
          createVersion(board.roomId, 'Avant effacement du tableau', userId).catch(console.error);
        }
        board.elements.clear();
        applied.push({ t: 'clear' });
        break;
      }
      default:
        break;
    }
  }
  if (applied.length) {
    board.changes += applied.length;
    board.lastUserId = userId;
    scheduleSave(board);
  }
  return applied;
}

export function replaceElements(board, list, userId) {
  board.elements = new Map(list.map(sanitizeElement).filter(Boolean).slice(0, MAX_ELEMENTS).map((e) => [e.id, e]));
  board.changes += 1;
  board.lastUserId = userId;
  scheduleSave(board);
}

function scheduleSave(board) {
  clearTimeout(board.saveTimer);
  board.saveTimer = setTimeout(() => saveBoard(board).catch(console.error), SAVE_DELAY_MS);
}

export async function saveBoard(board) {
  clearTimeout(board.saveTimer);
  board.saveTimer = null;
  await query(
    `INSERT INTO whiteboards (room_id, data, locked, updated_by) VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE data = VALUES(data), locked = VALUES(locked), updated_by = VALUES(updated_by)`,
    [board.roomId, JSON.stringify(elementsOf(board)), board.locked ? 1 : 0, board.lastUserId],
  );
  if (board.changes > 0 && Date.now() - board.lastVersionAt > AUTO_VERSION_MS && board.elements.size) {
    await createVersion(board.roomId, 'Sauvegarde automatique', board.lastUserId);
  }
}

export async function setLocked(board, locked, userId) {
  board.locked = locked;
  board.lastUserId = userId;
  await saveBoard(board);
}

export async function createVersion(roomId, label, userId) {
  const board = await loadBoard(roomId);
  const list = elementsOf(board);
  const res = await query(
    'INSERT INTO whiteboard_versions (room_id, data, label, element_count, created_by) VALUES (?,?,?,?,?)',
    [roomId, JSON.stringify(list), label.slice(0, 100), list.length, userId || null],
  );
  board.changes = 0;
  board.lastVersionAt = Date.now();
  const old = await query('SELECT id FROM whiteboard_versions WHERE room_id = ? ORDER BY id DESC LIMIT 1000 OFFSET ?', [
    roomId,
    MAX_VERSIONS,
  ]);
  if (old.length) await query('DELETE FROM whiteboard_versions WHERE id IN (?)', [old.map((o) => o.id)]);
  return res.insertId;
}

export async function flushAll() {
  await Promise.all([...boards.values()].filter((b) => b.saveTimer).map((b) => saveBoard(b).catch(console.error)));
}

export function forgetBoard(roomId) {
  const b = boards.get(roomId);
  if (b) clearTimeout(b.saveTimer);
  boards.delete(roomId);
}

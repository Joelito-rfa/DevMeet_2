import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../db/pool.js';
import { parse, notFound } from '../utils/http.js';
import { requireMember } from '../services/rooms.js';
import { loadBoard, elementsOf, createVersion, replaceElements } from '../services/boardStore.js';
import { getIo, boardChannel } from '../socket/io.js';

const router = Router({ mergeParams: true });

router.use(async (req, _res, next) => {
  try {
    req.roomId = Number(req.params.id);
    req.membership = (await requireMember(req.roomId, req.userId)).membership;
    next();
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req, res) => {
  const board = await loadBoard(req.roomId);
  res.json({ elements: elementsOf(board), locked: board.locked });
});

router.get('/versions', async (req, res) => {
  const rows = await query(
    `SELECT v.id, v.label, v.element_count, v.created_at, u.display_name, u.id AS uid, u.avatar_url, u.accent_color
     FROM whiteboard_versions v LEFT JOIN users u ON u.id = v.created_by
     WHERE v.room_id = ? ORDER BY v.id DESC`,
    [req.roomId],
  );
  res.json({
    versions: rows.map((r) => ({
      id: r.id,
      label: r.label,
      elementCount: r.element_count,
      createdAt: r.created_at,
      author: r.uid ? { id: r.uid, displayName: r.display_name, avatarUrl: r.avatar_url, accentColor: r.accent_color } : null,
    })),
  });
});

router.get('/versions/:vid', async (req, res) => {
  const row = await one('SELECT * FROM whiteboard_versions WHERE id = ? AND room_id = ?', [Number(req.params.vid), req.roomId]);
  if (!row) throw notFound('Version introuvable');
  res.json({ version: { id: row.id, label: row.label, createdAt: row.created_at, elements: JSON.parse(row.data) } });
});

router.post('/versions', async (req, res) => {
  const { label } = parse(z.object({ label: z.string().trim().min(1).max(100).optional() }), req.body || {});
  const id = await createVersion(req.roomId, label || 'Version enregistrée', req.userId);
  res.status(201).json({ id });
});

async function replaceAndBroadcast(req, elements, label) {
  const board = await loadBoard(req.roomId);
  if (board.elements.size) await createVersion(req.roomId, label, req.userId);
  replaceElements(board, elements, req.userId);
  getIo()?.to(boardChannel(req.roomId)).emit('board:replace', { roomId: req.roomId, elements: elementsOf(board), by: req.userId });
  return board;
}

router.post('/versions/:vid/restore', async (req, res) => {
  const row = await one('SELECT * FROM whiteboard_versions WHERE id = ? AND room_id = ?', [Number(req.params.vid), req.roomId]);
  if (!row) throw notFound('Version introuvable');
  const board = await replaceAndBroadcast(req, JSON.parse(row.data), 'Avant restauration');
  res.json({ elements: elementsOf(board) });
});

router.post('/import', async (req, res) => {
  const { elements } = parse(z.object({ elements: z.array(z.any()).max(5000) }), req.body);
  const board = await replaceAndBroadcast(req, elements, 'Avant import');
  res.json({ elements: elementsOf(board) });
});

export default router;

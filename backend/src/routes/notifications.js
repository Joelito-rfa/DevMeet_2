import { Router } from 'express';
import { query } from '../db/pool.js';
import { NOTIFICATION_SELECT, notificationDto } from '../services/notifications.js';

const router = Router();

router.get('/', async (req, res) => {
  const rows = await query(`${NOTIFICATION_SELECT} WHERE n.user_id = ? ORDER BY n.id DESC LIMIT 50`, [req.userId]);
  res.json({ notifications: rows.map(notificationDto) });
});

router.post('/read-all', async (req, res) => {
  await query('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [req.userId]);
  res.json({ ok: true });
});

router.post('/:id/read', async (req, res) => {
  await query('UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?', [Number(req.params.id), req.userId]);
  res.json({ ok: true });
});

router.delete('/', async (req, res) => {
  await query('DELETE FROM notifications WHERE user_id = ?', [req.userId]);
  res.json({ ok: true });
});

export default router;

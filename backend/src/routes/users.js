import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { query, one } from '../db/pool.js';
import { config } from '../config.js';
import { parse, badRequest, notFound } from '../utils/http.js';
import { selfUser, publicUser } from '../utils/serialize.js';
import { clearAuthCookie } from '../middleware/auth.js';
import * as presence from '../services/presence.js';
import { getIo, userChannel } from '../socket/io.js';

const router = Router();

const avatarDir = path.join(config.uploadDir, 'avatars');
fs.mkdirSync(avatarDir, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: avatarDir,
    filename: (_req, file, cb) => cb(null, `${nanoid(16)}${path.extname(file.originalname).toLowerCase().slice(0, 6)}`),
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)),
});

async function broadcastProfile(userId) {
  const row = await one('SELECT * FROM users WHERE id = ?', [userId]);
  getIo()?.emit('user:updated', publicUser(row));
  return row;
}

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(64).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.]{3,32}$/, "Nom d'utilisateur invalide")
    .optional(),
  email: z.string().trim().toLowerCase().email('E-mail invalide').optional(),
  bio: z.string().max(500).nullable().optional(),
  customStatus: z.string().max(128).nullable().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  preferredStatus: z.enum(['online', 'idle', 'dnd', 'invisible']).optional(),
});

router.patch('/me', async (req, res) => {
  const data = parse(profileSchema, req.body);
  if (data.username || data.email) {
    const dup = await one('SELECT id, username, email FROM users WHERE (username = ? OR email = ?) AND id <> ?', [
      data.username || '',
      data.email || '',
      req.userId,
    ]);
    if (dup) throw badRequest(dup.email === data.email ? 'E-mail déjà utilisé' : "Nom d'utilisateur déjà pris");
  }
  const map = {
    displayName: 'display_name',
    username: 'username',
    email: 'email',
    bio: 'bio',
    customStatus: 'custom_status',
    accentColor: 'accent_color',
    preferredStatus: 'preferred_status',
  };
  const sets = [];
  const params = [];
  for (const [key, col] of Object.entries(map)) {
    if (data[key] !== undefined) {
      sets.push(`${col} = ?`);
      params.push(data[key] === '' ? null : data[key]);
    }
  }
  if (sets.length) await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, req.userId]);
  if (data.preferredStatus) presence.setPreferred(req.userId, data.preferredStatus);
  if (data.customStatus !== undefined) presence.setCustomStatus(req.userId, data.customStatus || null);
  const row = await broadcastProfile(req.userId);
  res.json({ user: selfUser(row) });
});

router.post('/me/avatar', avatarUpload.single('avatar'), async (req, res) => {
  if (!req.file) throw badRequest('Image invalide (PNG, JPG, GIF ou WEBP, 4 Mo max)');
  const prev = await one('SELECT avatar_url FROM users WHERE id = ?', [req.userId]);
  await query('UPDATE users SET avatar_url = ? WHERE id = ?', [`/uploads/avatars/${req.file.filename}`, req.userId]);
  if (prev?.avatar_url?.startsWith('/uploads/avatars/')) {
    fs.promises.unlink(path.join(avatarDir, path.basename(prev.avatar_url))).catch(() => {});
  }
  const row = await broadcastProfile(req.userId);
  res.json({ user: selfUser(row) });
});

router.delete('/me/avatar', async (req, res) => {
  await query('UPDATE users SET avatar_url = NULL WHERE id = ?', [req.userId]);
  const row = await broadcastProfile(req.userId);
  res.json({ user: selfUser(row) });
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères').max(128),
});

router.patch('/me/password', async (req, res) => {
  const { currentPassword, newPassword } = parse(passwordSchema, req.body);
  const user = await one('SELECT password_hash FROM users WHERE id = ?', [req.userId]);
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) throw badRequest('Mot de passe actuel incorrect');
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 11), req.userId]);
  res.json({ ok: true });
});

router.delete('/me', async (req, res) => {
  const { password } = parse(z.object({ password: z.string().min(1, 'Mot de passe requis') }), req.body);
  const user = await one('SELECT password_hash FROM users WHERE id = ?', [req.userId]);
  if (!(await bcrypt.compare(password, user.password_hash))) throw badRequest('Mot de passe incorrect');
  await query('DELETE FROM users WHERE id = ?', [req.userId]);
  getIo()?.in(userChannel(req.userId)).disconnectSockets(true);
  presence.forget(req.userId);
  clearAuthCookie(res);
  res.json({ ok: true });
});

/** Export RGPD : toutes les données personnelles de l'utilisateur. */
router.get('/me/export', async (req, res) => {
  const user = await one('SELECT * FROM users WHERE id = ?', [req.userId]);
  const rooms = await query(
    `SELECT r.id, r.name, r.type, r.description, rm.role, rm.joined_at
     FROM room_members rm JOIN rooms r ON r.id = rm.room_id WHERE rm.user_id = ?`,
    [req.userId],
  );
  const messages = await query(
    `SELECT m.id, m.room_id, r.name AS room_name, m.content, m.attachment, m.created_at, m.edited_at
     FROM messages m JOIN rooms r ON r.id = m.room_id
     WHERE m.user_id = ? AND m.deleted_at IS NULL ORDER BY m.id`,
    [req.userId],
  );
  const reactions = await query('SELECT message_id, icon, created_at FROM message_reactions WHERE user_id = ?', [req.userId]);
  const notifications = await query('SELECT type, room_id, content, created_at, read_at FROM notifications WHERE user_id = ?', [
    req.userId,
  ]);
  const payload = {
    exportedAt: new Date().toISOString(),
    application: 'DevMeet',
    profile: selfUser(user),
    rooms,
    messages,
    reactions,
    notifications,
  };
  res.setHeader('Content-Disposition', `attachment; filename="devmeet-${user.username}-donnees.json"`);
  res.json(payload);
});

router.get('/', async (req, res) => {
  const search = String(req.query.search || '').trim();
  const rows = await query(
    `SELECT * FROM users WHERE id <> ? AND (username LIKE ? OR display_name LIKE ?) ORDER BY display_name LIMIT 20`,
    [req.userId, `%${search}%`, `%${search}%`],
  );
  res.json({ users: rows.map((r) => ({ ...publicUser(r), presence: presence.publicPresence(r.id) })) });
});

router.get('/:id', async (req, res) => {
  const row = await one('SELECT * FROM users WHERE id = ?', [Number(req.params.id)]);
  if (!row) throw notFound('Utilisateur introuvable');
  res.json({ user: { ...publicUser(row), createdAt: row.created_at, lastSeenAt: row.last_seen_at } });
});

export default router;

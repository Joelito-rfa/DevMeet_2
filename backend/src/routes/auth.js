import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query, one } from '../db/pool.js';
import { parse, badRequest, unauthorized } from '../utils/http.js';
import { selfUser } from '../utils/serialize.js';
import { setAuthCookie, clearAuthCookie, requireAuth } from '../middleware/auth.js';
import { addMember } from '../services/rooms.js';

const router = Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false });

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#3b82f6'];

const registerSchema = z.object({
  displayName: z.string().trim().min(2, 'Nom trop court').max(64),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.]{3,32}$/, "Nom d'utilisateur : 3 à 32 caractères (lettres, chiffres, _ ou .)"),
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').max(128),
});

router.post('/register', limiter, async (req, res) => {
  const data = parse(registerSchema, req.body);
  const exists = await one('SELECT username, email FROM users WHERE username = ? OR email = ?', [data.username, data.email]);
  if (exists) {
    throw badRequest(exists.email === data.email ? 'Cette adresse e-mail est déjà utilisée' : "Ce nom d'utilisateur est déjà pris");
  }
  const hash = await bcrypt.hash(data.password, 11);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const result = await query(
    'INSERT INTO users (username, email, password_hash, display_name, accent_color) VALUES (?,?,?,?,?)',
    [data.username, data.email, hash, data.displayName, color],
  );
  // Ajoute automatiquement le nouvel utilisateur aux salons publics "Général"
  const general = await query("SELECT id FROM rooms WHERE type='room' AND is_private=0 AND category='general'");
  for (const r of general) await addMember(r.id, result.insertId);

  const user = await one('SELECT * FROM users WHERE id = ?', [result.insertId]);
  setAuthCookie(res, user.id);
  res.status(201).json({ user: selfUser(user) });
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Identifiant requis'),
  password: z.string().min(1, 'Mot de passe requis'),
});

router.post('/login', limiter, async (req, res) => {
  const { identifier, password } = parse(loginSchema, req.body);
  const user = await one('SELECT * FROM users WHERE email = ? OR username = ?', [identifier.toLowerCase(), identifier.toLowerCase()]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw unauthorized('Identifiants incorrects');
  }
  setAuthCookie(res, user.id);
  res.json({ user: selfUser(user) });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await one('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!user) {
    clearAuthCookie(res);
    throw unauthorized();
  }
  res.json({ user: selfUser(user) });
});

export default router;

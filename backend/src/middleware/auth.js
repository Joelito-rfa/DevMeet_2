import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthorized } from '../utils/http.js';

export function signToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return Number(payload.sub) || null;
  } catch {
    return null;
  }
}

export function setAuthCookie(res, userId) {
  res.cookie(config.cookieName, signToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 7 * 24 * 3600 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(config.cookieName, { path: '/' });
}

export function requireAuth(req, _res, next) {
  const userId = verifyToken(req.cookies?.[config.cookieName]);
  if (!userId) return next(unauthorized());
  req.userId = userId;
  next();
}

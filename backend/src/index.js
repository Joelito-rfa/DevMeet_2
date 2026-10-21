import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { pool } from './db/pool.js';
import { errorHandler, notFound } from './utils/http.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import roomRoutes from './routes/rooms.js';
import inviteRoutes from './routes/invites.js';
import boardRoutes from './routes/board.js';
import notificationRoutes from './routes/notifications.js';
import { initSocket } from './socket/index.js';
import { flushAll } from './services/boardStore.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' }, contentSecurityPolicy: false }));
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '8mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/rooms/:id/board', requireAuth, boardRoutes);
app.use('/api/rooms', requireAuth, roomRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);
app.use('/api', requireAuth, inviteRoutes);
app.use('/uploads/avatars', express.static(path.join(config.uploadDir, 'avatars'), { maxAge: '7d' }));
app.use('/api', (_req, _res, next) => next(notFound('Route inconnue')));

// En production, le serveur Express sert aussi le build du client.
if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}

app.use(errorHandler);

const server = http.createServer(app);
initSocket(server);

async function start() {
  await migrate({ silent: true });
  await pool.query('SELECT 1');
  server.listen(config.port, () => {
    console.log(`DevMeet API prête sur http://localhost:${config.port}`);
  });
}

async function shutdown() {
  console.log('\nArrêt : sauvegarde des tableaux…');
  await flushAll();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('SIGTERM', shutdown);

start().catch((err) => {
  console.error('Impossible de démarrer le serveur :', err.message);
  process.exit(1);
});

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT || 4000),
  isProd: process.env.NODE_ENV === 'production',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5180',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  cookieName: 'devmeet_token',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'devmeet',
  },
  uploadDir: path.resolve(__dirname, '../uploads'),
  clientDist: path.resolve(__dirname, '../../frontend/dist'),
  maxUploadBytes: 15 * 1024 * 1024,
};

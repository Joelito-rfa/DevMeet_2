import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Anciens emoji d'icônes de salon → nom d'icône lucide. */
const LEGACY_ROOM_ICONS = [
  ['🏠', 'house'],
  ['🚀', 'rocket'],
  ['💡', 'lightbulb'],
  ['⚙️', 'settings'],
  ['🎨', 'palette'],
  ['🤝', 'handshake'],
  ['☕', 'coffee'],
  ['💬', 'message-circle'],
];

/** Format attendu pour un nom d'icône stocké en base (kebab-case). */
const ICON_NAME_SQL = "^[a-z][a-z0-9-]{0,30}$";

async function columnType(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return rows[0]?.COLUMN_TYPE || null;
}

/**
 * Migration des icônes : les emoji stockés en base sont remplacés par des noms
 * d'icônes UI (lucide) au format kebab-case.
 */
async function migrateIcons(connection) {
  // Réactions : colonne « emoji » (ancienne) → colonne « icon ».
  const legacyReactions = await columnType(connection, 'message_reactions', 'emoji');
  const reactions = await columnType(connection, 'message_reactions', 'icon');
  if (legacyReactions && !reactions) {
    await connection.query(`DELETE FROM message_reactions WHERE emoji NOT REGEXP '${ICON_NAME_SQL}'`);
    await connection.query('ALTER TABLE message_reactions CHANGE emoji icon VARCHAR(32) NOT NULL');
  } else if (reactions) {
    await connection.query(`DELETE FROM message_reactions WHERE icon NOT REGEXP '${ICON_NAME_SQL}'`);
  }

  // Icônes de salon : emoji → nom d'icône.
  for (const [emoji, name] of LEGACY_ROOM_ICONS) {
    await connection.query('UPDATE rooms SET icon = ? WHERE icon = ?', [name, emoji]);
  }
  await connection.query(
    `UPDATE rooms SET icon = 'message-circle' WHERE icon IS NULL OR icon NOT REGEXP '${ICON_NAME_SQL}'`,
  );

  const iconType = await columnType(connection, 'rooms', 'icon');
  if (iconType && iconType.toLowerCase() !== 'varchar(32)') {
    await connection.query('ALTER TABLE rooms MODIFY icon VARCHAR(32) NULL');
  }
}

export async function migrate({ silent = false } = {}) {
  const { database, ...conn } = config.db;
  const connection = await mysql.createConnection({ ...conn, multipleStatements: true, charset: 'utf8mb4' });
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.query(`USE \`${database}\``);
    const schema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
    await connection.query(schema);
    await migrateIcons(connection);
    if (!silent) console.log(`[db] Schéma à jour (${database})`);
  } finally {
    await connection.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

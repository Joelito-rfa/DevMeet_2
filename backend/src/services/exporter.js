import { query } from '../db/pool.js';

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const csvCell = (s = '') => `"${String(s ?? '').replace(/"/g, '""')}"`;
const fmt = (d) => new Date(d).toLocaleString('fr-FR', { timeZone: 'UTC' }) + ' UTC';
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'salon';

/** Génère l'export de l'historique d'un salon dans le format demandé. */
export async function buildChatExport(room, format, userId) {
  const rows = await query(
    `SELECT m.id, m.type, m.content, m.attachment, m.created_at, m.edited_at, u.display_name, u.username
     FROM messages m LEFT JOIN users u ON u.id = m.user_id
     WHERE m.room_id = ? AND m.deleted_at IS NULL ORDER BY m.id`,
    [room.id],
  );
  let name = room.name;
  if (room.type === 'dm') {
    const [peer] = await query(
      'SELECT u.display_name FROM room_members rm JOIN users u ON u.id = rm.user_id WHERE rm.room_id = ? AND rm.user_id <> ?',
      [room.id, userId],
    );
    name = `Conversation avec ${peer?.display_name || 'inconnu'}`;
  }
  const date = new Date().toISOString().slice(0, 10);
  const base = `devmeet-${slug(name)}-${date}`;
  const messages = rows.map((r) => ({
    id: r.id,
    type: r.type,
    author: r.type === 'system' ? 'Système' : r.display_name || 'Utilisateur supprimé',
    username: r.username,
    content: r.content,
    attachment: r.attachment ? { name: r.attachment.name, size: r.attachment.size, mime: r.attachment.mime } : null,
    createdAt: r.created_at,
    editedAt: r.edited_at,
  }));
  const line = (m) => `${m.content}${m.attachment ? `${m.content ? ' ' : ''}[Fichier : ${m.attachment.name}]` : ''}`;

  switch (format) {
    case 'csv': {
      const head = ['id', 'date', 'auteur', 'type', 'message', 'piece_jointe'].map(csvCell).join(',');
      const body = messages
        .map((m) => [m.id, new Date(m.createdAt).toISOString(), m.author, m.type, m.content, m.attachment?.name || ''].map(csvCell).join(','))
        .join('\n');
      return { body: '﻿' + head + '\n' + body, mime: 'text/csv', filename: `${base}.csv` };
    }
    case 'txt': {
      const body = [`DevMeet — ${name}`, `Exporté le ${fmt(new Date())}`, '='.repeat(60), '']
        .concat(messages.map((m) => (m.type === 'system' ? `— ${m.content} (${fmt(m.createdAt)})` : `[${fmt(m.createdAt)}] ${m.author} : ${line(m)}`)))
        .join('\n');
      return { body, mime: 'text/plain', filename: `${base}.txt` };
    }
    case 'md': {
      const body = [`# ${name}`, '', `_Exporté depuis DevMeet le ${fmt(new Date())}_`, '']
        .concat(messages.map((m) => (m.type === 'system' ? `> _${m.content}_` : `**${m.author}** · _${fmt(m.createdAt)}_  \n${line(m)}\n`)))
        .join('\n');
      return { body, mime: 'text/markdown', filename: `${base}.md` };
    }
    case 'html': {
      const items = messages
        .map((m) =>
          m.type === 'system'
            ? `<div class="sys">${esc(m.content)} · ${esc(fmt(m.createdAt))}</div>`
            : `<div class="msg"><div class="av">${esc(m.author[0] || '?')}</div><div><div class="meta"><b>${esc(m.author)}</b><span>${esc(fmt(m.createdAt))}</span></div><div class="txt">${esc(line(m))}</div></div></div>`,
        )
        .join('\n');
      const body = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(name)} — DevMeet</title>
<style>body{font-family:Inter,system-ui,sans-serif;background:#0f1424;color:#e5e7eb;max-width:820px;margin:40px auto;padding:0 16px}
h1{font-size:22px;margin:0}p.sub{color:#8b93a7;margin:4px 0 28px}.msg{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #1e2640}
.av{width:36px;height:36px;border-radius:50%;background:#6366f1;display:grid;place-items:center;font-weight:700;flex:none}
.meta{display:flex;gap:10px;align-items:baseline}.meta span{color:#8b93a7;font-size:12px}.txt{white-space:pre-wrap;margin-top:2px;line-height:1.5}
.sys{color:#8b93a7;font-size:13px;text-align:center;padding:10px 0;font-style:italic}</style></head>
<body><h1>${esc(name)}</h1><p class="sub">Exporté depuis DevMeet le ${esc(fmt(new Date()))} · ${messages.length} messages</p>${items}</body></html>`;
      return { body, mime: 'text/html', filename: `${base}.html` };
    }
    default:
      return {
        body: JSON.stringify({ room: { id: room.id, name, description: room.description }, exportedAt: new Date().toISOString(), messages }, null, 2),
        mime: 'application/json',
        filename: `${base}.json`,
      };
  }
}

import bcrypt from 'bcryptjs';
import { migrate } from './migrate.js';
import { pool, query, one } from './pool.js';

const PASSWORD = 'devmeet123';

const users = [
  ['alice', 'Alice Martin', 'alice@devmeet.dev', '#8b5cf6', 'Développeuse full-stack · fan de schémas'],
  ['bob', 'Bob Rakoto', 'bob@devmeet.dev', '#3b82f6', 'Backend & bases de données'],
  ['claire', 'Claire Dubois', 'claire@devmeet.dev', '#f59e0b', 'Designer UI/UX'],
  ['david', 'David Andria', 'david@devmeet.dev', '#10b981', 'Étudiant en génie logiciel'],
];

const rooms = [
  ['Général', 'Le salon de tout le monde : annonces et discussions libres', 'house', '#3b82f6', 'general', 0],
  ['Salon de projet', 'Conception du projet DevMeet', 'rocket', '#6366f1', 'projet', 1],
  ['Brainstorming', 'Idées folles bienvenues', 'lightbulb', '#8b5cf6', 'brainstorming', 0],
  ['Dev Team', 'Coordination technique', 'settings', '#a855f7', 'projet', 1],
  ['Design UI/UX', 'Maquettes, palettes et retours', 'palette', '#f59e0b', 'projet', 0],
  ['Entraide', 'Posez vos questions de cours ou de code', 'handshake', '#10b981', 'entraide', 0],
  ['Détente', 'Pause café virtuelle', 'coffee', '#ec4899', 'detente', 0],
];

const sid = () => Math.random().toString(36).slice(2, 12);

function demoBoard() {
  const s1 = sid(), s2 = sid(), s3 = sid(), s4 = sid();
  const box = (id, x, text, stroke) => ({ id, type: 'rect', x, y: 330, width: 150, height: 60, stroke, strokeWidth: 3, fill: 'transparent', text, fontSize: 22, fontFamily: 'Caveat', z: 2, radius: 6 });
  return [
    { id: sid(), type: 'text', x: 80, y: 60, text: 'Idées du projet', fontSize: 44, fontFamily: 'Caveat', fill: '#111827', z: 1 },
    { id: sid(), type: 'text', x: 90, y: 130, text: '• Authentification\n• Tableau collaboratif\n• Chat en temps réel\n• Salons vocaux\n• Partage de fichiers', fontSize: 28, fontFamily: 'Caveat', fill: '#111827', z: 1 },
    { id: sid(), type: 'sticky', x: 470, y: 60, width: 200, height: 180, fill: '#fde68a', text: 'Ne pas oublier\n\n• Exporter le tableau\n• Réunion à 16h', fontSize: 24, fontFamily: 'Caveat', rotation: -3, z: 3 },
    { id: sid(), type: 'text', x: 400, y: 260, text: 'Flux utilisateur', fontSize: 36, fontFamily: 'Caveat', fill: '#dc2626', z: 1 },
    box(s1, 120, 'Connexion', '#16a34a'),
    box(s2, 340, 'Salon', '#2563eb'),
    box(s3, 560, 'Tableau', '#eab308'),
    { ...box(s4, 560, 'Chat / Vocal', '#9333ea'), y: 460 },
    { id: sid(), type: 'arrow', points: [0, 0, 0, 0], stroke: '#111827', strokeWidth: 2.5, fromId: s1, toId: s2, z: 4 },
    { id: sid(), type: 'arrow', points: [0, 0, 0, 0], stroke: '#111827', strokeWidth: 2.5, fromId: s2, toId: s3, z: 4 },
    { id: sid(), type: 'arrow', points: [0, 0, 0, 0], stroke: '#111827', strokeWidth: 2.5, fromId: s3, toId: s4, z: 4 },
    { id: sid(), type: 'ellipse', x: 820, y: 180, width: 120, height: 120, stroke: '#2563eb', strokeWidth: 3, fill: 'rgba(37,99,235,0.08)', z: 2 },
    { id: sid(), type: 'text', x: 800, y: 330, text: 'Bonne idée !', fontSize: 34, fontFamily: 'Caveat', fill: '#db2777', rotation: -8, z: 1 },
  ];
}

async function seed() {
  await migrate();
  const existing = await one('SELECT COUNT(*) AS n FROM users');
  if (existing.n > 0 && !process.argv.includes('--force')) {
    console.log('La base contient déjà des données. Relancez avec --force pour tout réinitialiser.');
    process.exit(0);
  }
  if (process.argv.includes('--force')) {
    await query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['notifications', 'whiteboard_versions', 'whiteboards', 'invites', 'message_reactions', 'messages', 'room_members', 'rooms', 'users']) {
      await query(`TRUNCATE TABLE ${t}`);
    }
    await query('SET FOREIGN_KEY_CHECKS = 1');
  }

  const hash = await bcrypt.hash(PASSWORD, 11);
  const ids = {};
  for (const [username, name, email, color, bio] of users) {
    const r = await query('INSERT INTO users (username, email, password_hash, display_name, accent_color, bio) VALUES (?,?,?,?,?,?)', [username, email, hash, name, color, bio]);
    ids[username] = r.insertId;
  }
  const all = Object.values(ids);
  const roomIds = {};
  for (const [name, description, icon, color, category, isPrivate] of rooms) {
    const r = await query('INSERT INTO rooms (type, name, description, icon, color, category, is_private, owner_id) VALUES (?,?,?,?,?,?,?,?)', ['room', name, description, icon, color, category, isPrivate, ids.alice]);
    roomIds[name] = r.insertId;
    for (const uid of all) {
      await query('INSERT INTO room_members (room_id, user_id, role) VALUES (?,?,?)', [r.insertId, uid, uid === ids.alice ? 'owner' : uid === ids.bob ? 'admin' : 'member']);
    }
    await query("INSERT INTO messages (room_id, type, content) VALUES (?, 'system', ?)", [r.insertId, 'Alice Martin a créé le salon']);
  }

  const convo = [
    ['alice', 'Bonjour tout le monde !'],
    ['bob', 'Salut ! Voici le diagramme du flux utilisateur, je l’ai mis sur le tableau.'],
    ['claire', "J'ai ajouté quelques idées sur le tableau."],
    ['david', "Top ! @alice on fait le point à 16h ?"],
    ['alice', 'Parfait, on se retrouve en vocal.'],
  ];
  let lastId = 0;
  for (const [u, content] of convo) {
    const r = await query('INSERT INTO messages (room_id, user_id, content) VALUES (?,?,?)', [roomIds['Salon de projet'], ids[u], content]);
    lastId = r.insertId;
  }
  const first = await query('SELECT MIN(id) AS id FROM messages WHERE room_id = ? AND user_id IS NOT NULL', [roomIds['Salon de projet']]);
  await query('INSERT INTO message_reactions (message_id, user_id, icon) VALUES (?,?,?), (?,?,?)', [first[0].id, ids.bob, 'thumbs-up', first[0].id, ids.claire, 'thumbs-up']);
  await query('UPDATE room_members SET last_read_message_id = ?, last_delivered_message_id = ? WHERE room_id = ?', [lastId - 1, lastId, roomIds['Salon de projet']]);

  await query('INSERT INTO messages (room_id, user_id, content) VALUES (?,?,?)', [roomIds['Général'], ids.bob, 'Bienvenue sur DevMeet ! Créez vos salons et invitez votre équipe.']);

  const dm = await query("INSERT INTO rooms (type, name, is_private, dm_key) VALUES ('dm', 'Message privé', 1, ?)", [[ids.alice, ids.bob].sort((a, b) => a - b).join(':')]);
  await query('INSERT INTO room_members (room_id, user_id) VALUES (?,?), (?,?)', [dm.insertId, ids.alice, dm.insertId, ids.bob]);
  await query('INSERT INTO messages (room_id, user_id, content) VALUES (?,?,?)', [dm.insertId, ids.bob, 'Tu as pu regarder la PR sur les sockets ?']);

  await query('INSERT INTO whiteboards (room_id, data) VALUES (?,?)', [roomIds['Salon de projet'], JSON.stringify(demoBoard())]);

  console.log('Données de démo créées.');
  console.log(`   Comptes : alice, bob, claire, david — mot de passe : ${PASSWORD}`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

# DevMeet — Backend

API Express + Socket.io du projet DevMeet : salons, messagerie temps réel, tableau blanc collaboratif, signalisation WebRTC vocale.

## Stack

Node.js, Express 5, **Socket.io 4** (rooms, reconnexion, récupération d'état), mysql2, JWT en cookie **httpOnly**, bcryptjs, Zod, Multer, Helmet, express-rate-limit. Base : **MySQL 8** (utf8mb4).

## Démarrage

Prérequis : **Node.js 20+**, **Docker Desktop** (ou un MySQL 8 local).

```bash
# 1. Dépendances
npm install

# 2. Base de données — au choix :
#   a) Docker (MySQL sur le port 3307) :
docker compose up -d
#   b) MySQL local : adaptez ./.env (DB_HOST=127.0.0.1, DB_PORT=3306, DB_USER, DB_PASSWORD)

# 3. Tables + données de démonstration
npm run seed          # (npm run seed -- --force pour réinitialiser complètement)

# 4. Lancer l'API
npm run dev           # http://localhost:4000
```

Les tables sont créées automatiquement au démarrage du serveur.

## Variables d'environnement (`.env`)

| Variable | Description |
|---|---|
| `PORT` | Port de l'API (4000) |
| `CLIENT_URL` | Origine du frontend autorisée par CORS (http://localhost:5180) |
| `JWT_SECRET` | Secret de signature des sessions — **à changer en production** |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Connexion MySQL |

## Architecture temps réel

- Chaque socket rejoint `user:{id}` et `room:{id}` pour tous ses salons (non-lus, notifications, présence), puis `board:{id}` uniquement quand le tableau est ouvert (curseurs et traits).
- **L'appartenance à un canal Socket.io fait office de contrôle d'accès** : un utilisateur exclu est retiré des canaux immédiatement.
- Le tableau est conservé **en mémoire** côté serveur pour une diffusion instantanée, puis **persisté en base avec un délai** (1,2 s) et versionné toutes les 10 min d'activité, avant un effacement, une restauration ou un import.
- Les curseurs sont envoyés en `volatile` et limités à ~30 envois/s ; les traits sont groupés toutes les 45 ms.
- Les accusés de lecture utilisent des **pointeurs par membre** (`last_delivered_message_id`, `last_read_message_id`) plutôt qu'une ligne par message.

## Structure

```
backend/
├── src/
│   ├── index.js            # Express + Socket.io
│   ├── db/                 # schéma SQL, migration, seed
│   ├── routes/             # auth, users, rooms, invites, board, notifications
│   ├── socket/             # chat, board, voice (signalisation)
│   └── services/           # présence, tableau en mémoire, messages, exports
├── uploads/                # pièces jointes des salons
├── docker-compose.yml      # MySQL de dev (port 3307)
└── .env                    # configuration locale (non versionnée)
```

## Production

```bash
npm start     # sur NODE_ENV=production, Express sert aussi le build du frontend (../frontend/dist)
```

Placez l'application derrière un reverse-proxy HTTPS (Nginx, Caddy) en transmettant les WebSockets. Le micro et le vocal nécessitent **HTTPS** (ou `localhost`). Pour des participants derrière des NAT restrictifs, ajoutez un serveur **TURN** (ex. coturn) dans `../frontend/src/voice/VoiceProvider.jsx` (`ICE_SERVERS`).

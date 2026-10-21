# DevMeet — Coworking virtuel collaboratif

Espace de travail en ligne pour étudiants et développeurs : **salons thématiques**, **tableau blanc collaboratif temps réel**, **messagerie**, **salons vocaux** et **présence instantanée**, le tout dans le navigateur (zéro installation).

![Stack](https://img.shields.io/badge/React-19-61dafb) ![Vite](https://img.shields.io/badge/Vite-8-646cff) ![Node](https://img.shields.io/badge/Express-5-000) ![MySQL](https://img.shields.io/badge/MySQL-8-4479a1) ![Socket.io](https://img.shields.io/badge/Socket.io-4-010101)

Deux projets indépendants qui communiquent en temps réel : `backend/` (API + WebSocket) et `frontend/` (interface). Chacun a son propre `README.md`, ses dépendances et ses commandes.

## Fonctionnalités

- **Salons & présence** : salons à partir de modèles thématiques (public/privé), invitations par lien / code 8 caractères / **QR code**, rôles propriétaire / admin / membre, statuts en ligne (Absent automatique, Ne pas déranger, Invisible, statut perso), sidebar par salon avec remplissage instantané et période de grâce à la reconnexion.
- **Tableau blanc (Konva)** : crayon, pinceau, surligneur, gomme, formes + flèches liées aux formes, texte, post-it, lasso multi-sélection, annuler/rétablir, **curseurs des participants en direct**, synchronisation trait par trait, zoom/déplacement, **mini-carte**, historique de versions avec restauration, verrouillage admin, exports PNG/JPEG/PDF/JSON.
- **Messagerie** : chat temps réel + messages privés, statuts d'envoi / réception / lecture, indicateur d'écriture, réactions, réponses, édition/suppression, **mentions @pseudo** avec autocomplétion, pièces jointes + messages vocaux, séparateur « Nouveaux », export HTML/MD/TXT/CSV/JSON.
- **Vocal** : WebRTC pair-à-pair avec signalisation Socket.io — micro, indicateur de parole, volume par participant, reconnexion auto, **réglages audio** (choix du micro/sortie, test micro, annulation d'écho).
- **Profil & données** : photo, bio, thème sombre/clair/système, sons et notifications navigateur, export RGPD (JSON), recherche **Ctrl+K**.

## Stack technique

| Couche | Outils |
|---|---|
| Front (`frontend/`) | React 19, Vite 8, Tailwind CSS 4, React Router 7, Zustand, react-konva, socket.io-client, jsPDF, sonner |
| Back (`backend/`) | Node.js, Express 5, Socket.io 4, mysql2, JWT httpOnly, bcrypt, Zod, Multer, Helmet, express-rate-limit |
| Base | MySQL 8 (utf8mb4), via Docker |
| Temps réel | Socket.io (présence/chat/tableau/signalisation) + WebRTC (audio) |

## Démarrage — deux terminaux

Prérequis : **Node.js 20+**, **Docker Desktop**.

```bash
# Terminal 1 — backend (API sur le port 4000)
cd backend
npm install
docker compose up -d          # MySQL (port 3307)
npm run seed                  # tables + données de démo
npm run dev

# Terminal 2 — frontend (front sur le port 5180)
cd frontend
npm install
npm run dev
```

Ouvrez http://localhost:5180 — comptes de démo : **alice**, **bob**, **claire**, **david** / mot de passe `devmeet123`.
Pour tester la collaboration, ouvrez deux navigateurs (ou une fenêtre privée) avec deux comptes différents.

> Détails et variables d'environnement : `backend/README.md` et `frontend/README.md`.

## Structure

```
DevMeet/
├── docs/                      # Cahier des charges, sprint plan
├── backend/                   # API Express + Socket.io + MySQL  → backend/README.md
└── frontend/                  # React + Vite (UI temps réel)     → frontend/README.md
```

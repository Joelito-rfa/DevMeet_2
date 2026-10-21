# DevMeet — Frontend

Interface React du projet DevMeet : salons, tableau blanc collaboratif temps réel (Konva), messagerie, salons vocaux (WebRTC), présence instantanée.

## Stack

React 19, Vite 8, Tailwind CSS 4, React Router 7, Zustand, **react-konva** (canvas), socket.io-client, lucide-react, qrcode.react, jsPDF, sonner, date-fns.

## Démarrage

Prérequis : **Node.js 20+**. Le backend doit tourner sur http://localhost:4000 (voir `../backend/README.md`).

```bash
# 1. Dépendances
npm install

# 2. Lancer le serveur de dev
npm run dev       # http://localhost:5180
```

Le port est défini dans `vite.config.js` et surchargeable via `VITE_DEV_PORT` (par défaut `5180`, en mode `strictPort` : le serveur échoue si le port est déjà pris).

Le proxy Vite transmet `/api`, `/uploads` et `/socket.io` vers l'API (port 4000, modifiable via `VITE_API_TARGET`).

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de dev (port 5180) |
| `npm run build` | Build de production dans `dist/` (servi par le backend en prod) |
| `npm run preview` | Prévisualiser le build |
| `node scripts/ssr-check.jsx` | Vérification du rendu SSR des pages auth |
| `node scripts/e2e-check.mjs` | Tests e2e headless (Edge + CDP, via http://127.0.0.1:9222) |

## Structure

```
frontend/
├── scripts/               # scripts de vérification (e2e headless, rendu SSR)
└── src/
    ├── pages/             # Accueil, Salons, Salon, Messages, Paramètres…
    ├── components/
    │   ├── whiteboard/    # tableau Konva, outils, historique, mini-carte
    │   ├── chat/          # messages, statuts, saisie, fichiers, membres
    │   ├── rooms/         # création, invitation/QR, paramètres
    │   └── layout/        # barre latérale, en-tête, recherche Ctrl+K
    ├── voice/             # WebRTC (signalisation via Socket.io)
    ├── store/             # état global (Zustand)
    └── hooks/             # temps réel, envoi optimiste
```

## Raccourcis du tableau

`V` sélection · `H`/`Espace` main · `P` crayon · `B` pinceau · `M` surligneur · `E` gomme · `L` ligne · `R` rectangle · `O` cercle · `D` losange · `G` triangle · `A` flèche · `T` texte · `N` post-it · `F` remplir · `I` pipette · `Ctrl+Z/Y` annuler/rétablir · `Ctrl+D` dupliquer · `Ctrl+C/V` copier/coller · `Ctrl+A` tout sélectionner · `Suppr` supprimer · `Maj+1` ajuster · `Maj` (en traçant) contraindre angle/carré.

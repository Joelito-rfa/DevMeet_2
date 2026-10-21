import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Home, Hash, Settings, Plus, CornerDownLeft, MessageSquare } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useApp } from '../../store/app';
import { api } from '../../lib/api';
import { usePalette } from './Header';
import { Avatar } from '../ui/Avatar';
import { RoomIcon } from '../ui/misc';
import { cn } from '../../lib/utils';

export default function CommandPalette() {
  const { open, setOpen } = usePalette();
  const rooms = useApp((s) => s.rooms);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!usePalette.getState().open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return setQ('');
    const t = setTimeout(() => {
      api.get(`/users?search=${encodeURIComponent(q)}`).then((r) => setUsers(r.users)).catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [q, open]);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const match = (t) => t?.toLowerCase().includes(s);
    const list = [];
    if (!s) {
      list.push({ key: 'home', icon: Home, label: 'Accueil', run: () => navigate('/') });
      list.push({ key: 'rooms', icon: Hash, label: 'Parcourir les salons', run: () => navigate('/rooms') });
      list.push({ key: 'new', icon: Plus, label: 'Créer un salon', run: () => navigate('/rooms?create=1') });
      list.push({ key: 'settings', icon: Settings, label: 'Paramètres', run: () => navigate('/settings') });
    }
    rooms
      .filter((r) => r.type === 'room' && (!s || match(r.name)))
      .slice(0, 6)
      .forEach((r) => list.push({ key: `r${r.id}`, room: r, label: r.name, hint: 'Salon', run: () => navigate(`/r/${r.id}`) }));
    users.slice(0, 6).forEach((u) =>
      list.push({
        key: `u${u.id}`,
        user: u,
        label: u.displayName,
        hint: `@${u.username}`,
        run: async () => {
          const { room } = await api.post('/rooms/dm', { userId: u.id });
          useApp.getState().upsertRoom(room);
          navigate(`/r/${room.id}`);
        },
      }),
    );
    return list;
  }, [q, rooms, users, navigate]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;
  const run = (item) => {
    setOpen(false);
    item?.run();
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]">
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="animate-pop-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-elevated shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-5 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === 'Enter') run(items[active]);
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Rechercher un salon, une personne…"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-subtle"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <p className="py-8 text-center text-sm text-muted">Aucun résultat</p>}
          {items.map((it, i) => (
            <button
              key={it.key}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(it)}
              className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm', i === active ? 'bg-selected text-fg' : 'text-muted hover:bg-hover')}
            >
              {it.room ? <RoomIcon room={it.room} size="sm" /> : it.user ? <Avatar user={it.user} size="sm" showStatus /> : <span className="grid size-7 place-items-center rounded-lg bg-panel-2"><it.icon className="size-4" /></span>}
              <span className="flex-1 truncate font-medium text-fg">{it.label}</span>
              {it.user && <MessageSquare className="size-4 text-subtle" />}
              {it.hint && <span className="text-xs text-subtle">{it.hint}</span>}
              {i === active && <CornerDownLeft className="size-4 text-subtle" />}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

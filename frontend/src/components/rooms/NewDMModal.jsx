import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { api } from '../../lib/api';
import { useApp } from '../../store/app';
import { STATUS } from '../../lib/utils';

export default function NewDMModal({ open, onClose }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();
  const presence = useApp((s) => s.presence);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => api.get(`/users?search=${encodeURIComponent(q)}`).then((r) => setUsers(r.users)).catch(() => {}), 150);
    return () => clearTimeout(t);
  }, [q, open]);

  const start = async (u) => {
    try {
      const { room } = await api.post('/rooms/dm', { userId: u.id });
      useApp.getState().upsertRoom(room);
      onClose();
      navigate(`/r/${room.id}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} icon={MessageSquarePlus} title="Nouveau message privé" description="Discutez et dessinez en tête-à-tête." size="sm">
      <div className="relative mb-3">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
        <input className="input !pl-9" autoFocus placeholder="Rechercher un nom ou un @pseudo" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="-mx-2 max-h-80 overflow-y-auto">
        {users.map((u) => {
          const st = presence[u.id]?.status || 'offline';
          return (
            <button key={u.id} onClick={() => start(u)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-hover">
              <Avatar user={u} size="md" showStatus />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{u.displayName}</div>
                <div className="truncate text-xs text-muted">@{u.username} · {STATUS[st].label}</div>
              </div>
            </button>
          );
        })}
        {!users.length && <p className="py-6 text-center text-sm text-muted">Aucun utilisateur trouvé</p>}
      </div>
    </Modal>
  );
}

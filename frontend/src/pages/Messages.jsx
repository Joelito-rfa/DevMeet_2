import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquarePlus, Search, MessageSquare } from 'lucide-react';
import { useApp } from '../store/app';
import { useAuth } from '../store/auth';
import { PageHeader } from '../components/layout/Header';
import { Avatar, useUserStatus } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/misc';
import NewDMModal from '../components/rooms/NewDMModal';
import { cn, formatShort, STATUS } from '../lib/utils';

function DMRow({ room }) {
  const me = useAuth((s) => s.user);
  const peer = useApp((s) => s.users[room.peer?.id]) || room.peer;
  const status = useUserStatus(peer?.id);
  const lm = room.lastMessage;
  return (
    <Link to={`/r/${room.id}`} className="flex items-center gap-4 rounded-2xl p-3 transition hover:bg-hover">
      <Avatar user={peer} size="lg" showStatus />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('truncate', room.unread ? 'font-bold' : 'font-semibold')}>{peer?.displayName || 'Utilisateur supprimé'}</span>
          <span className="text-xs text-subtle">{STATUS[status]?.label}</span>
          {lm && <span className="ml-auto shrink-0 text-xs text-subtle">{formatShort(lm.createdAt)}</span>}
        </div>
        <p className={cn('truncate text-sm', room.unread ? 'text-fg' : 'text-muted')}>
          {lm ? `${lm.authorId === me.id ? 'Vous : ' : ''}${lm.content}` : 'Démarrez la conversation'}
        </p>
      </div>
      {room.unread > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-on-accent">{room.unread}</span>}
    </Link>
  );
}

export default function Messages() {
  const rooms = useApp((s) => s.rooms);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const dms = rooms
    .filter((r) => r.type === 'dm' && (!q || r.peer?.displayName?.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
  return (
    <>
      <PageHeader><h1 className="text-base font-semibold">Messages privés</h1></PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4 lg:p-8">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
              <input className="input !pl-9" placeholder="Rechercher une conversation…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Button variant="primary" icon={MessageSquarePlus} onClick={() => setOpen(true)}>Nouveau</Button>
          </div>
          <div className="card mt-6 p-2">
            {dms.length ? dms.map((r) => <DMRow key={r.id} room={r} />) : <EmptyState icon={MessageSquare} title="Aucune conversation" description="Envoyez un message privé à un membre de vos salons." />}
          </div>
        </div>
      </div>
      <NewDMModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

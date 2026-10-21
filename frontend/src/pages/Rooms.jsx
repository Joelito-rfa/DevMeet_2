import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Users, KeyRound, Compass, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../store/app';
import { api } from '../lib/api';
import { PageHeader } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { RoomIcon, Tabs, EmptyState } from '../components/ui/misc';
import { AnimatedGrid } from '../components/motion/AnimatedGrid';
import CreateRoomModal from '../components/rooms/CreateRoomModal';
import JoinByCodeModal from '../components/rooms/JoinByCodeModal';
import { RoomCard } from './Home';
import { cn, ROOM_CATEGORIES } from '../lib/utils';
import { getIcon } from '../lib/icons';

export default function Rooms() {
  const [params, setParams] = useSearchParams();
  const rooms = useApp((s) => s.rooms);
  const navigate = useNavigate();
  const [tab, setTab] = useState(params.get('tab') === 'discover' ? 'discover' : 'mine');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [discover, setDiscover] = useState(null);
  const [createOpen, setCreateOpen] = useState(params.get('create') === '1');
  const [joinOpen, setJoinOpen] = useState(false);

  useEffect(() => {
    if (params.get('create') === '1') {
      setCreateOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    if (tab === 'discover') api.get('/rooms/discover').then((r) => setDiscover(r.rooms)).catch(() => setDiscover([]));
  }, [tab]);

  const filter = (list) => list.filter((r) => (cat === 'all' || r.category === cat) && (!q || r.name.toLowerCase().includes(q.toLowerCase())));
  const mine = useMemo(() => filter(rooms.filter((r) => r.type === 'room')), [rooms, q, cat]); // eslint-disable-line react-hooks/exhaustive-deps

  const join = async (room) => {
    try {
      const { room: r } = await api.post(`/rooms/${room.id}/join`);
      useApp.getState().upsertRoom(r);
      toast.success(`Vous avez rejoint « ${r.name} »`);
      navigate(`/r/${r.id}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <PageHeader>
        <h1 className="text-base font-semibold">Salons</h1>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-4 lg:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Tabs
              className="md:w-80"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'mine', label: 'Mes salons', icon: Users },
                { value: 'discover', label: 'Découvrir', icon: Compass },
              ]}
            />
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
              <input className="input !pl-9" placeholder="Rechercher un salon…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Button icon={KeyRound} onClick={() => setJoinOpen(true)}>Code</Button>
            <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>Créer un salon</Button>
          </div>
          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
            {[['all', 'Tous', 'sparkles'], ...Object.entries(ROOM_CATEGORIES).map(([k, v]) => [k, v.label, v.icon])].map(([k, l, name]) => {
              const Icon = getIcon(name);
              return (
                <button key={k} onClick={() => setCat(k)} className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition', cat === k ? 'border-accent bg-selected text-fg' : 'border-line text-muted hover:bg-hover hover:text-fg')}>
                  <Icon className="size-3.5" /> {l}
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            {tab === 'mine' ? (
              mine.length ? (
                <AnimatedGrid key={`${cat}-${q}`} items={mine} keyOf={(r) => r.id} renderItem={(r) => <RoomCard room={r} />} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" />
              ) : (
                <div className="card"><EmptyState icon={Users} title="Aucun salon" description="Aucun salon ne correspond à votre recherche." action={<Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>Créer un salon</Button>} /></div>
              )
            ) : discover === null ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="card h-36 animate-pulse" />)}</div>
            ) : filter(discover).length ? (
              <AnimatedGrid key={`discover-${cat}-${q}`} items={filter(discover)} keyOf={(r) => r.id} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" renderItem={(r) => (
                  <div key={r.id} className="card flex flex-col p-4">
                    <div className="flex items-start gap-3">
                      <RoomIcon room={r} size="lg" />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold">{r.name}</h3>
                        <p className="line-clamp-2 text-sm text-muted">{r.description || 'Aucune description'}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-muted"><Globe className="size-3.5" /> Public · {r.memberCount} membres</span>
                      <Button size="sm" variant="primary" onClick={() => join(r)}>Rejoindre</Button>
                    </div>
                  </div>
                )} />
            ) : (
              <div className="card"><EmptyState icon={Compass} title="Rien à découvrir" description="Vous avez déjà rejoint tous les salons publics. Créez-en un nouveau !" /></div>
            )}
          </div>
        </div>
      </div>
      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinByCodeModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </>
  );
}

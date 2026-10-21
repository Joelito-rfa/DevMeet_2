import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, KeyRound, MessageSquarePlus, Compass, ArrowRight, Volume2, Users, MessageCircle, Activity, Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '../store/app';
import { useAuth } from '../store/auth';
import { PageHeader, NotificationRow } from '../components/layout/Header';
import { Avatar, AvatarStack } from '../components/ui/Avatar';
import { RoomIcon, EmptyState } from '../components/ui/misc';
import { CountUp } from '../components/motion/CountUp';
import { TiltCard } from '../components/motion/TiltCard';
import { AnimatedGrid } from '../components/motion/AnimatedGrid';
import { cascadeParent, cascadeChild, drift } from '../lib/motion';
import CreateRoomModal from '../components/rooms/CreateRoomModal';
import JoinByCodeModal from '../components/rooms/JoinByCodeModal';
import NewDMModal from '../components/rooms/NewDMModal';
import { formatShort, STATUS } from '../lib/utils';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
}

export function RoomCard({ room }) {
  const presence = useApp((s) => s.presence);
  const voice = useApp((s) => s.voice[room.id]);
  const online = room.memberIds.filter((id) => presence[id] && presence[id].status !== 'offline');
  return (
    <TiltCard className="h-full" max={5}>
    <Link to={`/r/${room.id}`} className="group card relative flex h-full flex-col overflow-hidden p-4 transition hover:border-line-strong hover:shadow-pop">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: room.color }} />
      <div className="flex items-start gap-3">
        <RoomIcon room={room} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{room.name}</h3>
            {room.unread > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] leading-5 font-bold text-on-accent">{room.unread}</span>}
          </div>
          <p className="line-clamp-1 text-sm text-muted">{room.description || 'Aucune description'}</p>
        </div>
      </div>
      <div className="mt-4 min-h-[38px] rounded-xl bg-panel-2 px-3 py-2 text-xs text-muted">
        {room.lastMessage ? (
          <p className="line-clamp-1">
            {room.lastMessage.authorName && <b className="font-semibold text-fg">{room.lastMessage.authorName.split(' ')[0]} : </b>}
            {room.lastMessage.content}
            <span className="ml-1 text-subtle">· {formatShort(room.lastMessage.createdAt)}</span>
          </p>
        ) : (
          <p className="italic">Pas encore de messages</p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted">
          {online.length > 0 && <AvatarStack userIds={online} max={4} />}
          <span>{online.length} en ligne · {room.memberIds.length} membres</span>
        </div>
        {voice?.length > 0 ? (
          <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success"><Volume2 className="size-3" /> {voice.length} en vocal</span>
        ) : (
          <ArrowRight className="size-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-accent" />
        )}
      </div>
    </Link>
    </TiltCard>
  );
}

export default function Home() {
  const user = useAuth((s) => s.user);
  const rooms = useApp((s) => s.rooms);
  const presence = useApp((s) => s.presence);
  const users = useApp((s) => s.users);
  const notifications = useApp((s) => s.notifications);
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);

  const channels = rooms.filter((r) => r.type === 'room').sort((a, b) => Number(b.starred) - Number(a.starred) || (b.unread || 0) - (a.unread || 0));
  const unread = rooms.reduce((n, r) => n + (r.unread || 0), 0);

  const onlinePeople = useMemo(() => {
    const ids = new Set(rooms.flatMap((r) => r.memberIds));
    ids.delete(user.id);
    return [...ids].filter((id) => presence[id] && presence[id].status !== 'offline').map((id) => ({ id, p: presence[id] }));
  }, [rooms, presence, user.id]);

  const actions = [
    { icon: Plus, title: 'Créer un salon', text: 'Projet, entraide, détente…', onClick: () => setModal('create'), accent: true },
    { icon: KeyRound, title: 'Rejoindre avec un code', text: 'Lien, code ou QR code', onClick: () => setModal('join') },
    { icon: MessageSquarePlus, title: 'Nouveau message', text: 'Discuter en privé', onClick: () => setModal('dm') },
    { icon: Compass, title: 'Explorer', text: 'Salons publics', onClick: () => navigate('/rooms?tab=discover') },
  ];

  return (
    <>
      <PageHeader>
        <h1 className="text-base font-semibold">Accueil</h1>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl space-y-8 p-4 lg:p-8">
          <section className="relative overflow-hidden rounded-3xl border border-line bg-panel p-6 lg:p-8">
            <motion.div {...drift(48, 28, 11)} className="absolute -top-24 -right-24 size-72 rounded-full bg-accent/10 blur-3xl" />
            <motion.div {...drift(-36, -24, 13)} className="absolute -bottom-32 left-1/3 size-72 rounded-full bg-accent-2/[0.06] blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-center gap-4">
                <Avatar user={user} size="xl" showStatus />
                <div>
                  <p className="text-sm text-muted">{greeting()},</p>
                  <h2 className="text-3xl font-bold tracking-tight">{user.displayName.split(' ')[0]}</h2>
                  <p className="mt-1 text-sm text-muted">{user.customStatus || 'Prêt·e à collaborer ? Votre équipe vous attend.'}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Users, label: 'Salons', value: channels.length },
                  { icon: Activity, label: 'En ligne', value: onlinePeople.length },
                  { icon: MessageCircle, label: 'Non lus', value: unread },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-line bg-panel-2/70 px-4 py-3 backdrop-blur">
                    <s.icon className="mb-1 size-4 text-accent" />
                    <div className="text-2xl font-bold tabular-nums"><CountUp value={s.value} /></div>
                    <div className="text-xs text-muted">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <motion.section variants={cascadeParent} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {actions.map((a) => (
              <motion.button
                key={a.title}
                variants={cascadeChild}
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={a.onClick}
                className={`group flex items-center gap-4 rounded-2xl border bg-panel p-4 text-left transition hover:-translate-y-0.5 ${a.accent ? 'border-accent/40 hover:border-accent/70' : 'border-line hover:border-line-strong'}`}
              >
                <span className={`grid size-11 place-items-center rounded-xl ${a.accent ? 'bg-accent text-on-accent' : 'bg-panel-2 text-accent ring-1 ring-line'}`}>
                  <a.icon className="size-5" />
                </span>
                <div>
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs text-muted">{a.text}</div>
                </div>
              </motion.button>
            ))}
          </motion.section>

          <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Vos salons</h2>
                <Link to="/rooms" className="text-sm font-medium text-accent hover:underline">Tout voir</Link>
              </div>
              {channels.length ? (
                <AnimatedGrid items={channels.slice(0, 6)} keyOf={(r) => r.id} renderItem={(r) => <RoomCard room={r} />} className="grid gap-4 md:grid-cols-2" />
              ) : (
                <div className="card">
                  <EmptyState icon={Users} title="Aucun salon pour le moment" description="Créez votre premier salon ou rejoignez-en un avec un code d’invitation." />
                </div>
              )}
            </section>

            <aside className="space-y-6">
              <div className="card p-4">
                <h3 className="mb-3 flex items-center gap-2 font-semibold">
                  <span className="size-2 rounded-full bg-success" /> En ligne maintenant
                  <span className="ml-auto text-xs font-normal text-muted">{onlinePeople.length}</span>
                </h3>
                {onlinePeople.length === 0 && <p className="py-4 text-center text-sm text-muted">Personne d’autre n’est connecté.</p>}
                <div className="space-y-1">
                  {onlinePeople.slice(0, 8).map(({ id, p }) => {
                    const u = users[id];
                    const where = rooms.find((r) => r.id === p.roomId);
                    return (
                      <div key={id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                        <Avatar userId={id} size="md" showStatus />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{u?.displayName || '…'}</div>
                          <div className="truncate text-xs text-muted">
                            {p.customStatus || (where ? `Dans ${where.type === 'dm' ? 'un message privé' : where.name}` : STATUS[p.status]?.label)}
                          </div>
                        </div>
                        {where && where.type === 'room' && (
                          <Link to={`/r/${where.id}`} className="rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft">Rejoindre</Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="card p-4">
                <h3 className="mb-2 flex items-center gap-2 font-semibold"><Bell className="size-4 text-accent" /> Activité récente</h3>
                {notifications.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted">Rien de nouveau pour l’instant.</p>
                ) : (
                  <div className="-mx-2">
                    {notifications.slice(0, 4).map((n) => (
                      <NotificationRow key={n.id} n={n} onClick={() => n.roomId && navigate(`/r/${n.roomId}`)} />
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
      <CreateRoomModal open={modal === 'create'} onClose={() => setModal(null)} />
      <JoinByCodeModal open={modal === 'join'} onClose={() => setModal(null)} />
      <NewDMModal open={modal === 'dm'} onClose={() => setModal(null)} />
    </>
  );
}

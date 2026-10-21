import { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home, Hash, MessageSquare, Bell, Plus, Settings, LogOut, ChevronsLeft, ChevronsRight, Volume2, Star,
  Mic, MicOff, Headphones, HeadphoneOff, PhoneOff, PhoneCall, Signal, Cog,
} from 'lucide-react';
import { useApp } from '../../store/app';
import { useAuth } from '../../store/auth';
import { useVoice } from '../../voice/VoiceProvider';
import { Avatar, AvatarStack } from '../ui/Avatar';
import { RoomIcon } from '../ui/misc';
import { IconButton } from '../ui/Button';
import { ConfirmModal } from '../ui/Modal';
import CreateRoomModal from '../rooms/CreateRoomModal';
import NewDMModal from '../rooms/NewDMModal';
import { cn } from '../../lib/utils';

function NavItem({ to, icon: Icon, label, badge, collapsed, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'focus-ring group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition',
          isActive ? 'bg-selected text-fg' : 'text-muted hover:bg-hover hover:text-fg',
          collapsed && 'justify-center px-0',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-accent" />}
          <Icon className="size-[18px] shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{label}</span>}
          {badge > 0 && (
            <span className={cn('grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-on-accent', collapsed && 'absolute top-1 right-1 h-4 min-w-4 px-1 text-[9px]')}>
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function SectionTitle({ children, onAdd, collapsed, addLabel }) {
  if (collapsed) return <div className="mx-3 my-3 h-px bg-line" />;
  return (
    <div className="mt-5 mb-1.5 flex items-center justify-between px-3">
      <span className="text-[11px] font-semibold tracking-[0.08em] text-subtle uppercase">{children}</span>
      {onAdd && (
        <button onClick={onAdd} title={addLabel} className="focus-ring grid size-6 place-items-center rounded-md text-subtle transition hover:bg-hover hover:text-fg">
          <Plus className="size-4" />
        </button>
      )}
    </div>
  );
}

function RoomItem({ room, collapsed }) {
  const presence = useApp((s) => s.presence);
  const voice = useApp((s) => s.voice[room.id]);
  const voiceCtl = useVoice();
  const { speaking } = voiceCtl;
  const onlineCount = room.memberIds.filter((id) => presence[id] && presence[id].status !== 'offline').length;
  const here = room.memberIds.filter((id) => presence[id]?.roomId === room.id);
  const inVoiceHere = voiceCtl.roomId === room.id;
  const toggleVoice = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (inVoiceHere) voiceCtl.leave();
    else voiceCtl.join(room.id);
  };
  return (
    <div>
      <NavLink
        to={`/r/${room.id}`}
        title={collapsed ? room.name : undefined}
        className={({ isActive }) =>
          cn(
            'focus-ring group flex h-10 items-center gap-2.5 rounded-xl px-2 text-sm transition',
            isActive ? 'bg-selected text-fg ring-1 ring-line' : 'text-muted hover:bg-hover hover:text-fg',
            room.unread > 0 && 'font-semibold text-fg',
            collapsed && 'justify-center px-0',
          )
        }
      >
        <div className="relative">
          <RoomIcon room={room} size="sm" />
          {collapsed && room.unread > 0 && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-danger ring-2 ring-panel" />}
        </div>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate">{room.name}</span>
            {room.starred && <Star className="size-3 fill-warning text-warning" />}
            {voice?.length > 0 && <Volume2 className="size-3.5 text-success" />}
            <button
              onClick={toggleVoice}
              title={inVoiceHere ? 'Quitter le vocal' : 'Rejoindre le vocal'}
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-md transition',
                inVoiceHere ? 'text-success hover:bg-danger/15 hover:text-danger' : 'text-subtle opacity-0 group-hover:opacity-100 hover:bg-hover hover:text-success focus:opacity-100',
              )}
            >
              {inVoiceHere ? <PhoneOff className="size-3.5" /> : <PhoneCall className="size-3.5" />}
            </button>
            {room.unread > 0 ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-accent">{room.unread}</span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-subtle">
                <span className={cn('size-1.5 rounded-full', onlineCount ? 'bg-success' : 'bg-subtle/50')} />
                {onlineCount}
              </span>
            )}
          </>
        )}
      </NavLink>
      {!collapsed && (here.length > 0 || voice?.length > 0) && (
        <div className="mt-0.5 mb-1 ml-[46px] space-y-1">
          {here.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-subtle">
              <AvatarStack userIds={here} max={5} />
              <span className="truncate">{here.length} sur le salon</span>
            </div>
          )}
          {voice?.length > 0 && !inVoiceHere && (
            <button onClick={toggleVoice} className="flex items-center gap-1.5 text-xs font-medium text-success hover:underline">
              <PhoneCall className="size-3" /> Rejoindre le vocal ({voice.length})
            </button>
          )}
          {voice?.map((p) => (
            <div key={p.socketId} className="flex items-center gap-2 text-xs text-muted">
              <Avatar userId={p.userId} size="xs" speaking={speaking[p.userId]} />
              <VoiceName userId={p.userId} />
              {p.muted && <MicOff className="size-3 text-danger" />}
              {p.deafened && <HeadphoneOff className="size-3 text-danger" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VoiceName({ userId }) {
  const u = useApp((s) => s.users[userId]);
  return <span className="min-w-0 flex-1 truncate">{u?.displayName || '…'}</span>;
}

function DMItem({ room, collapsed }) {
  const peer = useApp((s) => s.users[room.peer?.id]) || room.peer;
  return (
    <NavLink
      to={`/r/${room.id}`}
      title={collapsed ? peer?.displayName : undefined}
      className={({ isActive }) =>
        cn(
          'focus-ring flex h-10 items-center gap-2.5 rounded-xl px-2 text-sm transition',
          isActive ? 'bg-selected text-fg ring-1 ring-line' : 'text-muted hover:bg-hover hover:text-fg',
          room.unread > 0 && 'font-semibold text-fg',
          collapsed && 'justify-center px-0',
        )
      }
    >
      <Avatar user={peer} size="sm" showStatus />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{peer?.displayName || 'Utilisateur supprimé'}</span>
          {room.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-accent">{room.unread}</span>}
        </>
      )}
    </NavLink>
  );
}

function VoiceBar({ collapsed }) {
  const voice = useVoice();
  const room = useApp((s) => s.rooms.find((r) => r.id === voice.roomId));
  const navigate = useNavigate();
  if (!voice.roomId) return null;
  if (collapsed) {
    return (
      <div className="mx-2 mb-2 flex flex-col items-center gap-1 rounded-xl border border-success/25 bg-success/10 p-1.5">
        <IconButton icon={voice.muted ? MicOff : Mic} label="Micro" size="sm" onClick={voice.toggleMute} className={voice.muted ? 'text-danger' : ''} />
        <IconButton icon={PhoneOff} label="Quitter le vocal" size="sm" onClick={voice.leave} className="text-danger" />
      </div>
    );
  }
  return (
    <div className="mx-3 mb-3 rounded-xl border border-success/25 bg-success/[0.08] p-2.5">
      <button onClick={() => navigate(`/r/${voice.roomId}`)} className="flex w-full items-center gap-2 text-left">
        <Signal className="size-4 text-success" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-success">Vocal connecté</div>
          <div className="truncate text-[11px] text-muted">{room?.type === 'dm' ? room.peer?.displayName : room?.name}</div>
        </div>
      </button>
      <div className="mt-2 flex items-center gap-1">
        <IconButton icon={voice.muted ? MicOff : Mic} label={voice.muted ? 'Activer le micro' : 'Couper le micro'} size="sm" onClick={voice.toggleMute} active={voice.muted} className={voice.muted ? '!bg-danger/15 !text-danger' : ''} />
        <IconButton icon={voice.deafened ? HeadphoneOff : Headphones} label={voice.deafened ? 'Réactiver le son' : 'Couper le son'} size="sm" onClick={voice.toggleDeafen} className={voice.deafened ? '!bg-danger/15 !text-danger' : ''} />
        <IconButton icon={Cog} label="Réglages audio" size="sm" onClick={() => navigate('/settings/voice')} />
        <button onClick={voice.leave} className="ml-auto flex h-8 items-center gap-1.5 rounded-lg bg-danger/15 px-2.5 text-xs font-medium text-danger hover:bg-danger/25">
          <PhoneOff className="size-3.5" /> Quitter
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ collapsed, onToggle, mobileOpen }) {
  const rooms = useApp((s) => s.rooms);
  const notifications = useApp((s) => s.notifications);
  const logout = useAuth((s) => s.logout);
  const [createOpen, setCreateOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const { channels, dms, dmUnread } = useMemo(() => {
    const channels = rooms.filter((r) => r.type === 'room').sort((a, b) => Number(b.starred) - Number(a.starred));
    const dms = rooms
      .filter((r) => r.type === 'dm')
      .sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
    return { channels, dms, dmUnread: dms.reduce((n, r) => n + (r.unread || 0), 0) };
  }, [rooms]);
  const unreadNotifs = notifications.filter((n) => !n.readAt).length;

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-server-sidebar transition-[width,transform] duration-200 lg:static lg:translate-x-0',
        collapsed ? 'w-[72px]' : 'w-[264px]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className={cn('flex h-16 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
        <img src="/logo.svg" alt="" className="size-8" />
        {!collapsed && <span className="flex-1 text-lg font-bold tracking-tight">DevMeet</span>}
        {!collapsed && <IconButton icon={ChevronsLeft} label="Réduire" size="sm" onClick={onToggle} className="max-lg:hidden" />}
      </div>
      {collapsed && (
        <div className="mb-1 flex justify-center">
          <IconButton icon={ChevronsRight} label="Déplier" size="sm" onClick={onToggle} />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-line bg-panel px-3 pb-3">
        <nav className="space-y-0.5">
          <NavItem to="/" end icon={Home} label="Accueil" collapsed={collapsed} />
          <NavItem to="/rooms" icon={Hash} label="Mes salons" collapsed={collapsed} />
          <NavItem to="/messages" icon={MessageSquare} label="Messages" badge={dmUnread} collapsed={collapsed} />
          <NavItem to="/notifications" icon={Bell} label="Notifications" badge={unreadNotifs} collapsed={collapsed} />
        </nav>

        <SectionTitle collapsed={collapsed} onAdd={() => setCreateOpen(true)} addLabel="Créer un salon">
          Salons
        </SectionTitle>
        <div className="space-y-0.5">
          {channels.map((r) => (
            <RoomItem key={r.id} room={r} collapsed={collapsed} />
          ))}
          {collapsed && (
            <button onClick={() => setCreateOpen(true)} title="Créer un salon" className="mx-auto grid size-9 place-items-center rounded-xl border border-dashed border-line-strong text-muted hover:text-fg">
              <Plus className="size-4" />
            </button>
          )}
        </div>

        <SectionTitle collapsed={collapsed} onAdd={() => setDmOpen(true)} addLabel="Nouveau message">
          Messages privés
        </SectionTitle>
        <div className="space-y-0.5">
          {dms.map((r) => (
            <DMItem key={r.id} room={r} collapsed={collapsed} />
          ))}
          {!collapsed && !dms.length && <p className="px-3 py-1 text-xs text-subtle">Aucune conversation</p>}
        </div>
      </div>

      <VoiceBar collapsed={collapsed} />
      <div className="space-y-0.5 border-t border-line p-3">
        <NavItem to="/settings" icon={Settings} label="Paramètres" collapsed={collapsed} />
        <button
          onClick={() => setConfirmLogout(true)}
          title={collapsed ? 'Déconnexion' : undefined}
          className={cn('focus-ring flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-danger/90 transition hover:bg-danger/10 hover:text-danger', collapsed && 'justify-center px-0')}
        >
          <LogOut className="size-[18px]" />
          {!collapsed && 'Déconnexion'}
        </button>
      </div>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <NewDMModal open={dmOpen} onClose={() => setDmOpen(false)} />
      <ConfirmModal
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={logout}
        title="Se déconnecter ?"
        description="Vous serez déconnecté de DevMeet sur cet appareil."
        confirmLabel="Déconnexion"
        danger
      />
    </aside>
  );
}

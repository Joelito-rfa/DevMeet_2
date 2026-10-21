import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Lock, Globe, Star, UserPlus, PhoneCall, PhoneOff, Settings, PanelRightClose, PanelRightOpen, PenTool, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../store/app';
import { useAuth } from '../store/auth';
import { useVoice } from '../voice/VoiceProvider';
import { socket } from '../lib/socket';
import { api } from '../lib/api';
import { PageHeader } from '../components/layout/Header';
import { Avatar, AvatarStack, useUserStatus } from '../components/ui/Avatar';
import { RoomIcon, Tabs } from '../components/ui/misc';
import { Button, IconButton } from '../components/ui/Button';
import { FullScreenLoader } from '../components/ui/Spinner';
import Whiteboard from '../components/whiteboard/Whiteboard';
import ChatPanel from '../components/chat/ChatPanel';
import VoicePanel from '../components/voice/VoicePanel';
import InviteModal from '../components/rooms/InviteModal';
import RoomSettingsModal from '../components/rooms/RoomSettingsModal';
import { cn, STATUS } from '../lib/utils';

function DMTitle({ peer }) {
  const status = useUserStatus(peer?.id);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar user={peer} size="md" showStatus />
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold">{peer?.displayName || 'Utilisateur supprimé'}</h1>
        <p className="truncate text-xs text-muted">{peer?.customStatus || STATUS[status]?.label}</p>
      </div>
    </div>
  );
}

export default function RoomPage() {
  const { roomId: param } = useParams();
  const roomId = Number(param);
  const navigate = useNavigate();
  const location = useLocation();
  const me = useAuth((s) => s.user);
  const room = useApp((s) => s.rooms.find((r) => r.id === roomId));
  const roomsLoaded = useApp((s) => s.roomsLoaded);
  const details = useApp((s) => s.details[roomId]);
  const presence = useApp((s) => s.presence);
  const voice = useVoice();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [mobileView, setMobileView] = useState('board');

  useEffect(() => {
    useApp.getState().setActiveRoom(roomId);
    socket.emit('presence:room', { roomId });
    useApp.getState().refreshRoom(roomId);
    return () => {
      useApp.getState().setActiveRoom(null);
      socket.emit('presence:room', { roomId: null });
    };
  }, [roomId]);

  useEffect(() => {
    if (location.state?.invite && room) {
      setInviteOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, room, navigate]);

  useEffect(() => {
    if (roomsLoaded && !room) {
      toast.error('Salon introuvable ou accès refusé');
      navigate('/', { replace: true });
    }
  }, [roomsLoaded, room, navigate]);

  if (!room) return <FullScreenLoader label="Ouverture du salon…" />;

  const members = details?.members || [];
  const isAdmin = ['owner', 'admin'].includes(room.role);
  const online = members.filter((m) => m.id === me.id || (presence[m.id] && presence[m.id].status !== 'offline'));
  const inVoiceHere = voice.roomId === room.id;

  const toggleStar = async () => {
    useApp.getState().patchRoom(room.id, { starred: !room.starred });
    await api.patch(`/rooms/${room.id}/prefs`, { starred: !room.starred }).catch(() => {});
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader>
        {room.type === 'dm' ? (
          <DMTitle peer={room.peer} />
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <RoomIcon room={room} size="md" className="hidden sm:grid" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold max-sm:max-w-[150px]">{room.name}</h1>
                {room.isPrivate ? <Lock className="size-3.5 shrink-0 text-muted" title="Salon privé" /> : <Globe className="size-3.5 shrink-0 text-muted" title="Salon public" />}
                <button onClick={toggleStar} title={room.starred ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
                  <Star className={cn('size-4 shrink-0 transition', room.starred ? 'fill-warning text-warning' : 'text-subtle hover:text-warning')} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted">
                <span className="size-1.5 shrink-0 rounded-full bg-success" />
                {online.length} en ligne
                <span className="hidden truncate text-subtle md:inline">· {room.description}</span>
              </div>
            </div>
            <div className="ml-2 hidden lg:block">
              <AvatarStack userIds={online.map((m) => m.id)} max={5} size="sm" />
            </div>
          </div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {room.type === 'room' && (
            <>
              <Button variant="secondary" size="sm" icon={UserPlus} onClick={() => setInviteOpen(true)} className="max-md:hidden">
                Inviter
              </Button>
              <IconButton icon={UserPlus} label="Inviter" onClick={() => setInviteOpen(true)} className="md:hidden" />
            </>
          )}
          {inVoiceHere ? (
            <>
              <Button variant="danger" size="sm" icon={PhoneOff} onClick={voice.leave} className="max-md:hidden">Quitter le vocal</Button>
              <IconButton icon={PhoneOff} label="Quitter le vocal" onClick={voice.leave} className="text-danger md:hidden" />
            </>
          ) : (
            <>
              <Button variant="primary" size="sm" icon={PhoneCall} loading={voice.joining} onClick={() => voice.join(room.id)} className="max-md:hidden">
                {room.type === 'dm' ? 'Appeler' : 'Commencer un vocal'}
              </Button>
              <IconButton icon={PhoneCall} label="Commencer un vocal" onClick={() => voice.join(room.id)} className="text-success md:hidden" />
            </>
          )}
          {room.type === 'room' && <IconButton icon={Settings} label="Paramètres du salon" onClick={() => setSettingsOpen(true)} className="max-sm:hidden" />}
          <IconButton icon={chatOpen ? PanelRightClose : PanelRightOpen} label={chatOpen ? 'Masquer la discussion' : 'Afficher la discussion'} onClick={() => setChatOpen((o) => !o)} className="max-lg:hidden" />
        </div>
      </PageHeader>

      <div className="border-b border-line p-2 lg:hidden">
        <Tabs
          value={mobileView}
          onChange={setMobileView}
          tabs={[
            { value: 'board', label: 'Tableau', icon: PenTool },
            { value: 'chat', label: 'Discussion', icon: MessageSquare, badge: room.unread || 0 },
          ]}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        <section className={cn('min-w-0 flex-1 p-3', mobileView !== 'board' && 'hidden lg:block')}>
          <Whiteboard roomId={room.id} isAdmin={isAdmin || room.type === 'dm'} roomName={room.type === 'dm' ? `conversation-${room.peer?.username}` : room.name} />
        </section>
        <aside
          className={cn(
            'min-h-0 flex-col border-l border-line bg-content',
            'w-full lg:w-[370px] lg:shrink-0',
            mobileView === 'chat' ? 'flex' : 'hidden',
            chatOpen ? 'lg:flex' : 'lg:hidden',
          )}
        >
          <ChatPanel room={room} members={members} visible={chatOpen || mobileView === 'chat'} />
          <VoicePanel room={room} />
        </aside>
      </div>

      {room.type === 'room' && (
        <>
          <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} room={room} canManage={isAdmin} />
          <RoomSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} room={room} members={members} />
        </>
      )}
    </div>
  );
}

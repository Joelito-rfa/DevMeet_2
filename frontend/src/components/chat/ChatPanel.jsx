import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Paperclip, Users, Download, FileJson, FileSpreadsheet, FileText, FileCode, Image as ImageIcon, Mic, Crown, Shield,
  Volume2, MoreHorizontal, UploadCloud,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../store/app';
import { useAuth } from '../../store/auth';
import { api, downloadFrom } from '../../lib/api';
import { useSendMessage } from '../../hooks/useSendMessage';
import { Avatar, useUserStatus } from '../ui/Avatar';
import { Tabs, EmptyState } from '../ui/misc';
import { Popover, MenuItem, MenuLabel } from '../ui/Popover';
import { IconButton } from '../ui/Button';
import MessageList from './MessageList';
import Composer from './Composer';
import TypingIndicator from './TypingIndicator';
import { cn, formatBytes, formatShort, STATUS } from '../../lib/utils';

export function ChatExportMenu({ roomId, trigger }) {
  const run = async (format) => {
    const t = toast.loading('Préparation de l’export…');
    try {
      await downloadFrom(`/rooms/${roomId}/export?format=${format}`, `conversation.${format}`);
      toast.success('Discussion exportée', { id: t });
    } catch (e) {
      toast.error(e.message, { id: t });
    }
  };
  return (
    <Popover className="w-60 p-1.5" trigger={trigger || (({ toggle }) => <IconButton icon={Download} label="Exporter la discussion" size="sm" onClick={toggle} />)}>
      {(close) => (
        <>
          <MenuLabel>Exporter la discussion</MenuLabel>
          {[
            ['html', FileCode, 'Page HTML (lisible)'],
            ['md', FileText, 'Markdown'],
            ['txt', FileText, 'Texte brut'],
            ['csv', FileSpreadsheet, 'CSV (Excel)'],
            ['json', FileJson, 'JSON (données)'],
          ].map(([f, Icon, label]) => (
            <MenuItem key={f} icon={Icon} onClick={() => { close(); run(f); }} right={<span className="text-[10px] text-subtle uppercase">.{f}</span>}>
              {label}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}

function FilesTab({ roomId }) {
  const [files, setFiles] = useState(null);
  const [filter, setFilter] = useState('all');
  useEffect(() => {
    api.get(`/rooms/${roomId}/files`).then((r) => setFiles(r.files)).catch(() => setFiles([]));
  }, [roomId]);
  if (!files) return <div className="p-6 text-center text-sm text-muted">Chargement…</div>;
  const list = files.filter((f) => filter === 'all' || f.kind === filter || (filter === 'file' && f.kind === 'video'));
  const icon = { image: ImageIcon, audio: Mic, video: FileText, file: FileText };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-1 px-3 pt-3">
        {[['all', 'Tous'], ['image', 'Images'], ['audio', 'Vocaux'], ['file', 'Documents']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={cn('rounded-full px-3 py-1 text-xs font-medium transition', filter === v ? 'bg-selected text-fg ring-1 ring-line' : 'bg-panel-2 text-muted hover:bg-hover hover:text-fg')}>{l}</button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Paperclip} title="Aucun fichier" description="Les fichiers partagés dans la discussion apparaîtront ici." />
      ) : (
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          {filter === 'image' ? (
            <div className="grid grid-cols-3 gap-1.5">
              {list.map((f) => (
                <a key={f.messageId} href={f.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg border border-line">
                  <img src={f.url} alt={f.name} className="size-full object-cover transition hover:scale-105" loading="lazy" />
                </a>
              ))}
            </div>
          ) : (
            list.map((f) => {
              const Icon = icon[f.kind] || FileText;
              return (
                <a key={f.messageId} href={`${f.url}?download=${encodeURIComponent(f.name)}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-hover">
                  {f.kind === 'image' ? (
                    <img src={f.url} alt="" className="size-10 rounded-lg object-cover" />
                  ) : (
                    <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent"><Icon className="size-5" /></span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{f.name}</span>
                    <span className="text-xs text-muted">{formatBytes(f.size)} · {f.author?.displayName} · {formatShort(f.createdAt)}</span>
                  </span>
                  <Download className="size-4 text-subtle" />
                </a>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function MemberRow({ m, roomId }) {
  const status = useUserStatus(m.id);
  const presence = useApp((s) => s.presence[m.id]);
  const location = useApp((s) => s.rooms.find((r) => r.id === presence?.roomId));
  const inVoice = useApp((s) => Object.entries(s.voice).find(([, list]) => list.some((p) => p.userId === m.id)));
  const me = useAuth((s) => s.user);
  const navigate = useNavigate();
  const offline = status === 'offline';
  const where =
    presence?.roomId === roomId ? 'Sur ce salon' : location ? `Dans ${location.type === 'dm' ? 'un message privé' : location.name}` : presence?.roomId ? 'Dans un autre salon' : null;

  const openDM = async () => {
    const { room } = await api.post('/rooms/dm', { userId: m.id });
    useApp.getState().upsertRoom(room);
    navigate(`/r/${room.id}`);
  };

  return (
    <Popover
      side="left"
      align="start"
      className="w-72 overflow-hidden"
      trigger={({ toggle }) => (
        <button onClick={toggle} className={cn('flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-hover', offline && 'opacity-55')}>
          <Avatar user={m} size="md" showStatus />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-sm font-medium">
              <span className="truncate">{m.displayName}</span>
              {m.role === 'owner' && <Crown className="size-3.5 shrink-0 text-warning" />}
              {m.role === 'admin' && <Shield className="size-3.5 shrink-0 text-accent" />}
            </div>
            <div className="truncate text-xs text-muted">
              {m.customStatus || (offline ? STATUS.offline.label : where || STATUS[status]?.label)}
            </div>
          </div>
          {inVoice && <Volume2 className="size-4 text-success" />}
        </button>
      )}
    >
      {() => (
        <div>
          <div className="h-16" style={{ background: `linear-gradient(120deg, ${m.accentColor}, ${m.accentColor}55)` }} />
          <div className="-mt-8 px-4 pb-4">
            <Avatar user={m} size="xl" showStatus className="rounded-full ring-4 ring-elevated" />
            <div className="mt-2 text-lg font-bold">{m.displayName}</div>
            <div className="text-sm text-muted">@{m.username}</div>
            {m.customStatus && <div className="mt-2 rounded-lg bg-panel-2 px-2.5 py-1.5 text-sm">{m.customStatus}</div>}
            {m.bio && <p className="mt-3 text-sm text-muted">{m.bio}</p>}
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <span className="size-2 rounded-full" style={{ background: STATUS[status]?.color }} />
              {STATUS[status]?.label}
              {where && !offline && <> · {where}</>}
            </div>
            {m.id !== me.id && (
              <button onClick={openDM} className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-on-accent transition hover:bg-accent-hover">
                <MessageSquare className="size-4" /> Envoyer un message
              </button>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}

function MembersTab({ roomId, members }) {
  const presence = useApp((s) => s.presence);
  const me = useAuth((s) => s.user);
  const isOn = (id) => id === me.id || (presence[id] && presence[id].status !== 'offline');
  const online = members.filter((m) => isOn(m.id));
  const offline = members.filter((m) => !isOn(m.id));
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-2">
      <div className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-subtle uppercase">En ligne — {online.length}</div>
      {online.map((m) => <MemberRow key={m.id} m={m} roomId={roomId} />)}
      {offline.length > 0 && <div className="px-2 pt-4 pb-1 text-[11px] font-semibold tracking-wider text-subtle uppercase">Hors ligne — {offline.length}</div>}
      {offline.map((m) => <MemberRow key={m.id} m={m} roomId={roomId} />)}
    </div>
  );
}

export default function ChatPanel({ room, members, visible = true }) {
  const [tab, setTab] = useState('chat');
  const [dragging, setDragging] = useState(false);
  const sender = useSendMessage(room.id);
  const isAdmin = ['owner', 'admin'].includes(room.role);
  const presence = useApp((s) => s.presence);
  const onlineCount = members.filter((m) => presence[m.id] && presence[m.id].status !== 'offline').length;

  useEffect(() => setTab('chat'), [room.id]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) {
      setTab('chat');
      sender.sendFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setDragging(false)}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-1 p-2">
        <Tabs
          className="flex-1"
          size="sm"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'chat', label: 'Chat' },
            { value: 'files', label: 'Fichiers' },
            { value: 'members', label: `Membres (${room.type === 'dm' ? members.length : onlineCount})` },
          ]}
        />
        <ChatExportMenu roomId={room.id} trigger={({ toggle }) => <IconButton icon={MoreHorizontal} label="Exporter" size="sm" onClick={toggle} />} />
      </div>
      {tab === 'chat' && (
        <>
          <MessageList roomId={room.id} visible={visible} onRetry={sender.retry} canModerate={isAdmin} />
          <TypingIndicator roomId={room.id} />
          <Composer roomId={room.id} members={members} sender={sender} placeholder={room.type === 'dm' ? `Message à ${room.peer?.displayName}` : `Écrire dans ${room.name}…`} />
        </>
      )}
      {tab === 'files' && <FilesTab roomId={room.id} />}
      {tab === 'members' && <MembersTab roomId={room.id} members={members} />}
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-accent-soft backdrop-blur-sm">
          <div className="text-center text-accent">
            <UploadCloud className="mx-auto mb-2 size-8" />
            <div className="font-semibold">Déposez pour partager</div>
          </div>
        </div>
      )}
    </div>
  );
}

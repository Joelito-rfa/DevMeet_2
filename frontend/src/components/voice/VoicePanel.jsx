import { Mic, MicOff, Headphones, HeadphoneOff, PhoneOff, Volume2, MoreVertical, PhoneCall } from 'lucide-react';
import { useApp } from '../../store/app';
import { useAuth } from '../../store/auth';
import { useVoice } from '../../voice/VoiceProvider';
import { Avatar } from '../ui/Avatar';
import { Popover } from '../ui/Popover';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

function Participant({ p, meId, speaking }) {
  const user = useApp((s) => s.users[p.userId]);
  const voice = useVoice();
  const isMe = p.userId === meId;
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-hover">
      <Avatar user={user} userId={p.userId} size="sm" speaking={speaking && !p.muted} />
      <span className={cn('min-w-0 flex-1 truncate text-sm', speaking && !p.muted && 'font-semibold text-success')}>
        {user?.displayName || '…'} {isMe && <span className="text-xs font-normal text-subtle">Vous</span>}
      </span>
      {p.deafened && <HeadphoneOff className="size-4 text-danger" />}
      {p.muted ? <MicOff className="size-4 text-danger" /> : <Mic className="size-4 text-success" />}
      {!isMe && (
        <Popover side="left" align="center" className="w-56 p-3" trigger={({ toggle }) => <button onClick={toggle} className="grid size-6 place-items-center rounded text-muted hover:text-fg"><MoreVertical className="size-4" /></button>}>
          {() => (
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted"><Volume2 className="size-3.5" /> Volume de {user?.displayName?.split(' ')[0]}</div>
              <input type="range" min={0} max={100} value={voice.volumes[p.userId] ?? 100} onChange={(e) => voice.setUserVolume(p.userId, Number(e.target.value))} className="w-full accent-[var(--accent)]" />
            </div>
          )}
        </Popover>
      )}
    </div>
  );
}

export default function VoicePanel({ room }) {
  const voice = useVoice();
  const me = useAuth((s) => s.user);
  const participants = useApp((s) => s.voice[room.id]) || [];
  const connectedHere = voice.roomId === room.id;

  return (
    <div className="border-t border-line p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold tracking-wider text-subtle uppercase">Salon vocal</span>
        {connectedHere ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-success"><span className="size-1.5 rounded-full bg-success" /> Connecté</span>
        ) : (
          participants.length > 0 && <span className="text-xs text-muted">{participants.length} en vocal</span>
        )}
      </div>
      {participants.length > 0 && (
        <div className="mb-2 max-h-44 space-y-0.5 overflow-y-auto">
          {participants.map((p) => <Participant key={p.socketId} p={p} meId={me.id} speaking={voice.speaking[p.userId]} />)}
        </div>
      )}
      {connectedHere ? (
        <div className="flex items-center gap-2">
          <button onClick={voice.toggleMute} title={voice.muted ? 'Activer le micro' : 'Couper le micro'} className={cn('grid size-10 place-items-center rounded-xl border transition', voice.muted ? 'border-danger/30 bg-danger/15 text-danger' : 'border-line bg-panel-2 text-fg hover:bg-hover')}>
            {voice.muted ? <MicOff className="size-[18px]" /> : <Mic className="size-[18px]" />}
          </button>
          <button onClick={voice.toggleDeafen} title={voice.deafened ? 'Réactiver le son' : 'Couper le son'} className={cn('grid size-10 place-items-center rounded-xl border transition', voice.deafened ? 'border-danger/30 bg-danger/15 text-danger' : 'border-line bg-panel-2 text-fg hover:bg-hover')}>
            {voice.deafened ? <HeadphoneOff className="size-[18px]" /> : <Headphones className="size-[18px]" />}
          </button>
          <button onClick={voice.leave} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/15 text-sm font-medium text-danger transition hover:bg-danger/25">
            <PhoneOff className="size-4" /> Quitter le vocal
          </button>
        </div>
      ) : (
        <Button variant="primary" className="w-full" icon={PhoneCall} loading={voice.joining} onClick={() => voice.join(room.id)}>
          {participants.length ? 'Rejoindre le vocal' : 'Démarrer un vocal'}
        </Button>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Check, Download, UserPlus, Link2, RefreshCw, Trash2, QrCode, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { cn, fromNow, inviteUrl } from '../../lib/utils';

const EXPIRY = [
  { label: '1 heure', value: 3600 },
  { label: '24 heures', value: 86400 },
  { label: '7 jours', value: 604800 },
  { label: '30 jours', value: 2592000 },
  { label: 'Jamais', value: null },
];
const USES = [
  { label: 'Illimité', value: null },
  { label: '1 utilisation', value: 1 },
  { label: '5 utilisations', value: 5 },
  { label: '10 utilisations', value: 10 },
  { label: '50 utilisations', value: 50 },
];

function CopyField({ value, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const t = document.createElement('textarea');
      t.value = value;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopied(true);
    toast.success(`${label} copié`);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-panel-2 p-1.5 pl-3">
      <span className="min-w-0 flex-1 truncate font-mono text-sm">{value}</span>
      <Button size="sm" variant={copied ? 'success' : 'primary'} icon={copied ? Check : Copy} onClick={copy}>
        {copied ? 'Copié' : 'Copier'}
      </Button>
    </div>
  );
}

export default function InviteModal({ open, onClose, room, canManage }) {
  const [invite, setInvite] = useState(null);
  const [invites, setInvites] = useState([]);
  const [expiresIn, setExpiresIn] = useState(604800);
  const [maxUses, setMaxUses] = useState(null);
  const [loading, setLoading] = useState(false);
  const qrRef = useRef(null);

  const loadList = useCallback(async () => {
    const { invites } = await api.get(`/rooms/${room.id}/invites`);
    setInvites(invites);
    return invites;
  }, [room?.id]);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const { invite } = await api.post(`/rooms/${room.id}/invites`, { expiresIn, maxUses });
      setInvite(invite);
      loadList();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [room?.id, expiresIn, maxUses, loadList]);

  useEffect(() => {
    if (!open || !room) return;
    loadList().then((list) => {
      const reusable = list.find((i) => !i.maxUses && (!i.expiresAt || new Date(i.expiresAt) - Date.now() > 3600_000));
      if (reusable) setInvite(reusable);
      else generate();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, room?.id]);

  const revoke = async (code) => {
    await api.del(`/invites/${code}`);
    if (invite?.code === code) setInvite(null);
    loadList();
    toast.success('Invitation révoquée');
  };

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `devmeet-invitation-${room.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  };

  const share = async () => {
    try {
      await navigator.share({ title: `Rejoignez ${room.name} sur DevMeet`, url: inviteUrl(invite.code) });
    } catch {
      /* partage annulé */
    }
  };

  if (!room) return null;
  const url = invite ? inviteUrl(invite.code) : '';

  return (
    <Modal open={open} onClose={onClose} icon={UserPlus} title={`Inviter dans ${room.name}`} description="Partagez le lien, le code ou le QR code." size="xl" className="!max-w-3xl">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-4">
          <div>
            <label className="label flex items-center gap-1.5"><Link2 className="size-3.5" /> Lien d’invitation</label>
            {invite ? <CopyField value={url} label="Lien" /> : <div className="h-11 animate-pulse rounded-xl bg-panel-2" />}
          </div>
          <div>
            <label className="label">Code du salon</label>
            {invite && (
              <div className="flex items-center gap-2">
                <div className="flex flex-1 justify-center gap-1.5 rounded-xl border border-dashed border-accent/40 bg-accent-soft py-2.5 font-mono text-xl font-bold tracking-[0.3em] text-accent">
                  {invite.code}
                </div>
                <Button variant="secondary" icon={Copy} onClick={() => navigator.clipboard.writeText(invite.code).then(() => toast.success('Code copié'))}>
                  Code
                </Button>
              </div>
            )}
            <p className="mt-1.5 text-xs text-subtle">À saisir via « Rejoindre avec un code » sur l’accueil.</p>
          </div>
          <div className="rounded-xl border border-line p-3">
            <div className="mb-2 text-sm font-semibold">Paramètres du lien</div>
            <div className="grid grid-cols-2 gap-2">
              <select className="input !py-2" value={expiresIn ?? ''} onChange={(e) => setExpiresIn(e.target.value ? Number(e.target.value) : null)}>
                {EXPIRY.map((o) => <option key={o.label} value={o.value ?? ''}>Expire : {o.label}</option>)}
              </select>
              <select className="input !py-2" value={maxUses ?? ''} onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : null)}>
                {USES.map((o) => <option key={o.label} value={o.value ?? ''}>{o.label}</option>)}
              </select>
            </div>
            <Button className="mt-2 w-full" size="sm" icon={RefreshCw} loading={loading} onClick={generate}>
              Générer un nouveau lien
            </Button>
          </div>
          {invite && (
            <p className="text-xs text-muted">
              {invite.expiresAt ? `Expire ${fromNow(invite.expiresAt)}` : 'N’expire jamais'} · {invite.maxUses ? `${invite.uses}/${invite.maxUses} utilisations` : `${invite.uses} utilisation(s)`}
            </p>
          )}
        </div>

        <div className="flex w-[210px] flex-col items-center justify-self-center">
          <label className="label flex items-center gap-1.5 self-start"><QrCode className="size-3.5" /> QR code</label>
          <div ref={qrRef} className="rounded-2xl bg-white p-3 shadow-sm">
            {invite ? (
              <QRCodeCanvas value={url} size={180} level="M" marginSize={0} fgColor="#111827" imageSettings={{ src: '/logo.svg', height: 34, width: 34, excavate: true }} />
            ) : (
              <div className="size-[180px] animate-pulse rounded-lg bg-line" />
            )}
          </div>
          <div className="mt-3 flex w-full gap-2">
            <Button size="sm" className="flex-1" icon={Download} onClick={downloadQr} disabled={!invite}>PNG</Button>
            {'share' in navigator && <Button size="sm" className="flex-1" icon={Share2} onClick={share} disabled={!invite}>Partager</Button>}
          </div>
        </div>
      </div>

      {invites.length > 0 && (
        <div className="mt-6">
          <div className="label">Invitations actives ({invites.length})</div>
          <div className="divide-y divide-line rounded-xl border border-line">
            {invites.map((i) => (
              <div key={i.code} className={cn('flex items-center gap-3 px-3 py-2 text-sm', invite?.code === i.code && 'bg-selected/60')}>
                <button onClick={() => setInvite(i)} className="font-mono font-semibold tracking-wider hover:text-accent">{i.code}</button>
                <span className="min-w-0 flex-1 truncate text-xs text-muted">
                  par {i.creatorName || '—'} · {i.uses}{i.maxUses ? `/${i.maxUses}` : ''} utilis. · {i.expiresAt ? `expire ${fromNow(i.expiresAt)}` : 'permanent'}
                </span>
                {canManage && (
                  <button onClick={() => revoke(i.code)} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger" title="Révoquer">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

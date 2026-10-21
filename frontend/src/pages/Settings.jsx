import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, Shield, Palette, Bell, Database, Camera, Trash2, Download, Moon, Sun, Monitor, Check, FileJson, Mic, RefreshCw, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../store/auth';
import { useApp } from '../store/app';
import { useTheme } from '../lib/theme';
import { api, upload, downloadFrom } from '../lib/api';
import { PageHeader } from '../components/layout/Header';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Switch, RoomIcon } from '../components/ui/misc';
import { ConfirmModal } from '../components/ui/Modal';
import { useVoice } from '../voice/VoiceProvider';
import { supportsSetSinkId } from '../lib/audioSettings';
import { ChatExportMenu } from '../components/chat/ChatPanel';
import { cn, formatFull, STATUS } from '../lib/utils';

const TABS = [
  { id: 'profile', label: 'Profil', icon: User },
  { id: 'account', label: 'Compte & sécurité', icon: Shield },
  { id: 'appearance', label: 'Apparence', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'voice', label: 'Voix', icon: Mic },
  { id: 'data', label: 'Mes données', icon: Database },
];
const ACCENTS = ['#5865f2', '#8b5cf6', '#a855f7', '#ec4899', '#ef4444', '#d29922', '#3fb950', '#06b6d4', '#3b82f6', '#64748b'];

function Section({ title, description, children, className }) {
  return (
    <section className={cn('card p-6', className)}>
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ProfileTab() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [form, setForm] = useState({ displayName: user.displayName, username: user.username, bio: user.bio || '', customStatus: user.customStatus || '', accentColor: user.accentColor });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target ? e.target.value : e });

  const save = async () => {
    setSaving(true);
    try {
      const { user: u } = await api.patch('/users/me', form);
      setUser(u);
      toast.success('Profil mis à jour');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onAvatar = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { user: u } = await upload('/users/me/avatar', file, { field: 'avatar' });
      setUser(u);
      toast.success('Photo de profil mise à jour');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    const { user: u } = await api.del('/users/me/avatar');
    setUser(u);
  };

  const preview = { ...user, ...form };
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <Section title="Profil public" description="Ces informations sont visibles par les membres de vos salons.">
        <div className="flex items-center gap-5">
          <div className="relative">
            <Avatar user={preview} size="2xl" />
            <button onClick={() => fileRef.current.click()} className="absolute right-0 bottom-0 grid size-9 place-items-center rounded-full bg-accent text-on-accent shadow-sm ring-4 ring-panel transition hover:bg-accent-hover" title="Changer la photo">
              <Camera className="size-4" />
            </button>
          </div>
          <div className="space-y-2">
            <Button size="sm" loading={uploading} onClick={() => fileRef.current.click()}>Téléverser une photo</Button>
            {user.avatarUrl && <Button size="sm" variant="ghost" icon={Trash2} onClick={removeAvatar}>Retirer</Button>}
            <p className="text-xs text-subtle">PNG, JPG, GIF ou WEBP · 4 Mo max</p>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={onAvatar} />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Nom affiché</label>
            <input className="input" maxLength={64} value={form.displayName} onChange={set('displayName')} />
          </div>
          <div>
            <label className="label">Nom d’utilisateur</label>
            <div className="relative">
              <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-subtle">@</span>
              <input className="input !pl-8" maxLength={32} value={form.username} onChange={set('username')} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Statut personnalisé</label>
            <input className="input" maxLength={128} value={form.customStatus} onChange={set('customStatus')} placeholder="Concentré sur le projet" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Bio</label>
            <textarea className="input min-h-24 resize-y" maxLength={500} value={form.bio} onChange={set('bio')} placeholder="Parlez un peu de vous : études, technos préférées…" />
            <p className="mt-1 text-right text-xs text-subtle">{form.bio.length}/500</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Couleur de profil</label>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, accentColor: c })} className={cn('grid size-8 place-items-center rounded-full transition hover:scale-110', form.accentColor === c && 'ring-2 ring-fg ring-offset-2 ring-offset-panel')} style={{ background: c }}>
                  {form.accentColor === c && <Check className="size-4 text-on-accent" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="primary" loading={saving} onClick={save}>Enregistrer les modifications</Button>
        </div>
      </Section>
      <div>
        <p className="label">Aperçu</p>
        <div className="card overflow-hidden">
          <div className="h-24" style={{ background: `linear-gradient(120deg, ${preview.accentColor}, ${preview.accentColor}55)` }} />
          <div className="-mt-10 px-5 pb-5">
            <Avatar user={preview} size="xl" showStatus className="rounded-full ring-4 ring-panel" />
            <div className="mt-2 text-lg font-bold">{preview.displayName}</div>
            <div className="text-sm text-muted">@{preview.username}</div>
            {preview.customStatus && <div className="mt-3 rounded-lg bg-panel-2 px-3 py-2 text-sm">{preview.customStatus}</div>}
            {preview.bio && <p className="mt-3 text-sm whitespace-pre-wrap text-muted">{preview.bio}</p>}
            <p className="mt-4 text-xs text-subtle">Membre depuis le {formatFull(user.createdAt).split(' à ')[0]}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountTab() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logout);
  const [email, setEmail] = useState(user.email);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [del, setDel] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [busy, setBusy] = useState('');

  const saveEmail = async () => {
    setBusy('email');
    try {
      const { user: u } = await api.patch('/users/me', { email });
      setUser(u);
      toast.success('Adresse e-mail mise à jour');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };
  const savePw = async () => {
    if (pw.newPassword !== pw.confirm) return toast.error('Les mots de passe ne correspondent pas');
    setBusy('pw');
    try {
      await api.patch('/users/me/password', pw);
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Mot de passe modifié');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };
  const deleteAccount = async () => {
    try {
      await api.del('/users/me', { password: delPw });
      toast.success('Compte supprimé');
      logout();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Section title="Adresse e-mail">
        <div className="flex gap-3">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button loading={busy === 'email'} onClick={saveEmail} disabled={email === user.email}>Mettre à jour</Button>
        </div>
      </Section>
      <Section title="Mot de passe" description="Utilisez au moins 8 caractères, idéalement avec chiffres et symboles.">
        <div className="space-y-3">
          <input className="input" type="password" placeholder="Mot de passe actuel" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" type="password" placeholder="Nouveau mot de passe" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" />
            <input className="input" type="password" placeholder="Confirmer" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" />
          </div>
          <div className="flex justify-end">
            <Button variant="primary" loading={busy === 'pw'} onClick={savePw} disabled={!pw.currentPassword || !pw.newPassword}>Changer le mot de passe</Button>
          </div>
        </div>
      </Section>
      <Section title="Zone de danger" className="border-danger/30">
        <div className="flex items-center gap-4">
          <p className="flex-1 text-sm text-muted">La suppression de votre compte est définitive. Vos messages resteront visibles sous « Utilisateur supprimé ».</p>
          <Button variant="danger" icon={Trash2} onClick={() => setDel(true)}>Supprimer mon compte</Button>
        </div>
      </Section>
      <ConfirmModal open={del} onClose={() => setDel(false)} onConfirm={deleteAccount} danger title="Supprimer définitivement votre compte ?" confirmLabel="Supprimer mon compte" description="Pensez à exporter vos données avant. Saisissez votre mot de passe pour confirmer.">
        <input className="input" type="password" placeholder="Mot de passe" value={delPw} onChange={(e) => setDelPw(e.target.value)} />
      </ConfirmModal>
    </div>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const options = [
    { id: 'dark', label: 'Sombre', icon: Moon, preview: 'bg-[#0d1117]' },
    { id: 'light', label: 'Clair', icon: Sun, preview: 'bg-[#eef1f8]' },
    { id: 'system', label: 'Système', icon: Monitor, preview: 'bg-gradient-to-r from-[#0d1117] to-[#eef1f8]' },
  ];
  return (
    <div className="max-w-2xl">
      <Section title="Thème" description="Choisissez l’apparence de DevMeet.">
        <div className="grid grid-cols-3 gap-3">
          {options.map((o) => (
            <button key={o.id} onClick={() => setTheme(o.id)} className={cn('overflow-hidden rounded-2xl border text-left transition', theme === o.id ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line-strong')}>
              <div className={cn('flex h-20 items-end gap-1.5 p-2', o.preview)}>
                <span className="h-full w-6 rounded-md bg-white/10 ring-1 ring-black/10" />
                <span className="h-10 flex-1 rounded-md bg-white ring-1 ring-black/10" />
              </div>
              <div className="flex items-center gap-2 p-3 text-sm font-medium"><o.icon className="size-4" /> {o.label}</div>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

function NotificationsTab() {
  const [sounds, setSounds] = useState(() => localStorage.getItem('devmeet-sounds') !== 'off');
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const user = useAuth((s) => s.user);
  return (
    <div className="max-w-2xl space-y-6">
      <Section title="Préférences">
        <div className="divide-y divide-line">
          <div className="flex items-center gap-4 pb-4">
            <div className="flex-1">
              <div className="font-medium">Sons</div>
              <p className="text-sm text-muted">Son discret à la réception d’un message, d’une mention ou à l’entrée dans un vocal.</p>
            </div>
            <Switch checked={sounds} onChange={(v) => { setSounds(v); localStorage.setItem('devmeet-sounds', v ? 'on' : 'off'); }} />
          </div>
          <div className="flex items-center gap-4 pt-4">
            <div className="flex-1">
              <div className="font-medium">Notifications du navigateur</div>
              <p className="text-sm text-muted">Recevez une alerte système quand l’onglet DevMeet est en arrière-plan.</p>
            </div>
            {perm === 'granted' ? (
              <span className="flex items-center gap-1 text-sm text-success"><Check className="size-4" /> Activées</span>
            ) : perm === 'unsupported' ? (
              <span className="text-sm text-subtle">Non supportées</span>
            ) : (
              <Button size="sm" onClick={() => Notification.requestPermission().then(setPerm)}>{perm === 'denied' ? 'Bloquées' : 'Activer'}</Button>
            )}
          </div>
        </div>
      </Section>
      <p className="text-sm text-muted">
        Statut actuel : <b className="text-fg">{STATUS[user.preferredStatus]?.label}</b>. En mode « Ne pas déranger », les sons et alertes sont désactivés.
      </p>
    </div>
  );
}

function MicTest({ deviceId }) {
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const refs = useRef({ stream: null, analyser: null, ctx: null, raf: 0 });

  const stop = () => {
    const r = refs.current;
    cancelAnimationFrame(r.raf);
    r.stream?.getTracks().forEach((t) => t.stop());
    r.ctx?.close().catch(() => {});
    refs.current = { stream: null, analyser: null, ctx: null, raf: 0 };
    setTesting(false);
    setLevel(0);
  };

  const start = async () => {
    setError('');
    try {
      const constraints = deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      await ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      refs.current = { stream, analyser, ctx, raf: 0 };
      setTesting(true);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
        refs.current.raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setError('Microphone inaccessible : vérifiez l’autorisation du navigateur.');
    }
  };

  useEffect(() => () => stop(), [deviceId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex items-center gap-3">
        <Button size="sm" variant={testing ? 'danger' : 'secondary'} icon={testing ? Square : Play} onClick={testing ? stop : start}>
          {testing ? 'Arrêter le test' : 'Tester le micro'}
        </Button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel-2">
          <div className="h-full rounded-full bg-success transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {testing && <p className="mt-2 text-xs text-subtle">Parlez : la barre doit bouger. Sinon, changez d’entrée ou baissez le seuil de sensibilité.</p>}
    </div>
  );
}

function VoiceTab() {
  const { audioSettings, saveAudio, devices, refreshDevices, testSpeaker } = useVoice();
  const [scanning, setScanning] = useState(false);
  const canChooseOutput = supportsSetSinkId();
  const label = (d, i, kind) => d.label || `${kind} ${i + 1}`;

  const scan = async () => {
    setScanning(true);
    try {
      await refreshDevices();
    } finally {
      setScanning(false);
    }
  };

  const processing = [
    { key: 'echoCancellation', title: 'Annulation d’écho', desc: 'Évite que vos interlocuteurs s’entendent en retour.' },
    { key: 'noiseSuppression', title: 'Réduction du bruit', desc: 'Filtre les bruits de fond (clavier, ventilateur…).' },
    { key: 'autoGainControl', title: 'Volume automatique', desc: 'Stabilise le niveau de votre micro.' },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <Section title="Périphériques" description="Choisissez le micro et la sortie utilisés pour les vocaux.">
        <div className="space-y-4">
          <div>
            <label className="label">Entrée (microphone)</label>
            <select className="input" value={audioSettings.inputDeviceId} onChange={(e) => saveAudio({ inputDeviceId: e.target.value })}>
              <option value="default">Microphone par défaut du système</option>
              {devices.inputs.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>{label(d, i, 'Microphone')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Sortie (haut-parleurs / casque)</label>
            <select
              className="input"
              value={audioSettings.outputDeviceId}
              disabled={!canChooseOutput}
              onChange={(e) => saveAudio({ outputDeviceId: e.target.value })}
            >
              <option value="default">Sortie par défaut du système</option>
              {devices.outputs.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>{label(d, i, 'Sortie')}</option>
              ))}
            </select>
            {!canChooseOutput && <p className="mt-1 text-xs text-subtle">Votre navigateur ne permet pas de choisir la sortie (utilisez Chrome ou Edge).</p>}
          </div>
          <Button size="sm" variant="ghost" icon={RefreshCw} loading={scanning} onClick={scan}>Actualiser la liste</Button>
        </div>
      </Section>
      <Section title="Test du microphone" description="Vérifiez que votre micro capte bien votre voix.">
        <MicTest deviceId={audioSettings.inputDeviceId} />
      </Section>
      <Section title="Sensibilité" description="Seuil à partir duquel vous apparaissez comme « en train de parler ». Vers la gauche = plus sensible.">
        <div className="flex items-center gap-3">
          <input
            type="range" min={1} max={15} step={1}
            value={Math.round((audioSettings.threshold ?? 0.035) * 100)}
            onChange={(e) => saveAudio({ threshold: Number(e.target.value) / 100 })}
            className="flex-1 accent-[var(--accent)]"
          />
          <span className="w-10 text-right text-sm text-muted">{Math.round((audioSettings.threshold ?? 0.035) * 100)}%</span>
        </div>
      </Section>
      <Section title="Traitement de la voix" description="Appliqués au micro au prochain vocal rejoint.">
        <div className="divide-y divide-line">
          {processing.map((p, i) => (
            <div key={p.key} className={cn('flex items-center gap-4', i > 0 && 'pt-4', i < processing.length - 1 && 'pb-4')}>
              <div className="flex-1">
                <div className="font-medium">{p.title}</div>
                <p className="text-sm text-muted">{p.desc}</p>
              </div>
              <Switch checked={audioSettings[p.key]} onChange={(v) => saveAudio({ [p.key]: v })} />
            </div>
          ))}
        </div>
      </Section>
      <Section title="Haut-parleur" description="Joue un bip sur la sortie sélectionnée.">
        <Button icon={Play} onClick={testSpeaker}>Tester la sortie</Button>
      </Section>
      <p className="text-sm text-muted">Le micro et les traitements s’appliquent au prochain vocal rejoint. Le seuil et la sortie s’appliquent immédiatement.</p>
    </div>
  );
}

function DataTab() {
  const rooms = useApp((s) => s.rooms);
  const [busy, setBusy] = useState(false);
  const exportMine = async () => {
    setBusy(true);
    try {
      await downloadFrom('/users/me/export', 'devmeet-mes-donnees.json');
      toast.success('Export de vos données téléchargé');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-3xl space-y-6">
      <Section title="Exporter mes données personnelles" description="Profil, salons, messages envoyés, réactions et notifications au format JSON (conformité RGPD).">
        <Button variant="primary" icon={FileJson} loading={busy} onClick={exportMine}>Télécharger mes données</Button>
      </Section>
      <Section title="Exporter les discussions" description="Téléchargez l’historique complet d’un salon (HTML, Markdown, texte, CSV ou JSON). Pour exporter un tableau blanc en image, PDF ou JSON, utilisez le bouton « Exporter » du tableau.">
        <div className="divide-y divide-line rounded-xl border border-line">
          {rooms.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              {r.type === 'dm' ? <Avatar user={r.peer} size="sm" /> : <RoomIcon room={r} size="sm" />}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.type === 'dm' ? `Conversation avec ${r.peer?.displayName}` : r.name}</span>
              <ChatExportMenu roomId={r.id} trigger={({ toggle }) => <Button size="xs" icon={Download} onClick={toggle}>Exporter</Button>} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

export default function Settings() {
  const { tab = 'profile' } = useParams();
  const navigate = useNavigate();
  const current = TABS.find((t) => t.id === tab) || TABS[0];
  return (
    <>
      <PageHeader><h1 className="text-base font-semibold">Paramètres</h1></PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 lg:flex-row lg:p-8">
          <nav className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto lg:w-56 lg:flex-col">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => navigate(`/settings/${t.id}`)} className={cn('flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition', current.id === t.id ? 'bg-selected text-fg ring-1 ring-line' : 'text-muted hover:bg-hover hover:text-fg')}>
                <t.icon className="size-4" /> {t.label}
              </button>
            ))}
          </nav>
          <div className="min-w-0 flex-1">
            <h2 className="mb-5 text-2xl font-bold tracking-tight">{current.label}</h2>
            {current.id === 'profile' && <ProfileTab />}
            {current.id === 'account' && <AccountTab />}
            {current.id === 'appearance' && <AppearanceTab />}
            {current.id === 'notifications' && <NotificationsTab />}
            {current.id === 'voice' && <VoiceTab />}
            {current.id === 'data' && <DataTab />}
          </div>
        </div>
      </div>
    </>
  );
}

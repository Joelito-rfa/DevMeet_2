import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Lock, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { RoomIcon } from '../ui/misc';
import { api } from '../../lib/api';
import { useApp } from '../../store/app';
import { cn, ROOM_CATEGORIES } from '../../lib/utils';
import { ROOM_ICONS, ROOM_ICON_LABELS, getIcon, DEFAULT_ROOM_ICON } from '../../lib/icons';

export const ROOM_COLORS = ['#5865f2', '#8b5cf6', '#a855f7', '#ec4899', '#f85149', '#d29922', '#3fb950', '#06b6d4', '#3b82f6', '#64748b'];
export { ROOM_ICONS };

const TEMPLATES = [
  { category: 'projet', name: 'Projet', icon: 'rocket', color: '#5865f2', description: 'Concevoir et suivre un projet en équipe' },
  { category: 'entraide', name: 'Entraide', icon: 'handshake', color: '#3fb950', description: 'Questions de cours, débogage, revues de code' },
  { category: 'brainstorming', name: 'Brainstorming', icon: 'lightbulb', color: '#8b5cf6', description: 'Idées, schémas et cartes mentales' },
  { category: 'etude', name: 'Révisions', icon: 'book-open', color: '#d29922', description: 'Préparer un examen ensemble' },
  { category: 'detente', name: 'Détente', icon: 'coffee', color: '#ec4899', description: 'La machine à café virtuelle' },
  { category: 'autre', name: 'Personnalisé', icon: DEFAULT_ROOM_ICON, color: '#06b6d4', description: 'Partir de zéro' },
];

export function RoomForm({ value, onChange }) {
  const set = (k) => (v) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-panel-2 p-4">
        <RoomIcon room={value} size="xl" />
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">{value.name || 'Nom du salon'}</div>
          <div className="truncate text-sm text-muted">{value.description || 'Description du salon'}</div>
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-panel px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">
            {value.isPrivate ? <Lock className="size-3" /> : <Globe className="size-3" />}
            {value.isPrivate ? 'Privé · sur invitation' : 'Public · visible par tous'}
          </div>
        </div>
      </div>
      <div>
        <label className="label">Nom du salon</label>
        <input className="input" maxLength={64} value={value.name} onChange={(e) => set('name')(e.target.value)} placeholder="Ex : Projet de fin d’études" autoFocus />
      </div>
      <div>
        <label className="label">Description</label>
        <input className="input" maxLength={255} value={value.description || ''} onChange={(e) => set('description')(e.target.value)} placeholder="À quoi sert ce salon ?" />
      </div>
      <div>
        <label className="label">Icône</label>
        <div className="flex flex-wrap gap-1.5">
          {ROOM_ICONS.map((name) => {
            const Icon = getIcon(name);
            const label = ROOM_ICON_LABELS[name] || name;
            return (
              <button
                key={name}
                onClick={() => set('icon')(name)}
                title={label}
                aria-label={label}
                className={cn('grid size-9 place-items-center rounded-lg text-muted transition hover:bg-hover hover:text-fg', value.icon === name && 'bg-selected text-fg ring-2 ring-accent')}
              >
                <Icon className="size-[18px]" />
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="label">Couleur</label>
        <div className="flex flex-wrap gap-2">
          {ROOM_COLORS.map((c) => (
            <button key={c} onClick={() => set('color')(c)} className={cn('size-8 rounded-full transition hover:scale-110', value.color === c && 'ring-2 ring-fg ring-offset-2 ring-offset-panel')} style={{ background: c }} aria-label={c} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { v: true, icon: Lock, t: 'Privé', d: 'Accès par invitation (lien ou QR code)' },
          { v: false, icon: Globe, t: 'Public', d: 'Tout le monde peut le trouver et rejoindre' },
        ].map((o) => (
          <button
            key={o.t}
            onClick={() => set('isPrivate')(o.v)}
            className={cn('rounded-xl border p-3 text-left transition', value.isPrivate === o.v ? 'border-accent bg-selected' : 'border-line hover:border-line-strong hover:bg-hover')}
          >
            <o.icon className={cn('mb-1.5 size-4', value.isPrivate === o.v ? 'text-accent' : 'text-muted')} />
            <div className="text-sm font-semibold">{o.t}</div>
            <div className="text-xs text-muted">{o.d}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CreateRoomModal({ open, onClose }) {
  const navigate = useNavigate();
  const upsertRoom = useApp((s) => s.upsertRoom);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setForm(null);
    }
  }, [open]);

  const pick = (t) => {
    setForm({ name: t.category === 'autre' ? '' : t.name, description: t.description, icon: t.icon, color: t.color, category: t.category, isPrivate: true });
    setStep(1);
  };

  const submit = async () => {
    setLoading(true);
    try {
      const { room } = await api.post('/rooms', form);
      upsertRoom(room);
      onClose();
      toast.success(`Salon « ${room.name} » créé`);
      navigate(`/r/${room.id}`, { state: { invite: true } });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Sparkles}
      title={step === 0 ? 'Créer un salon' : 'Personnaliser le salon'}
      description={step === 0 ? 'Choisissez un modèle pour démarrer rapidement.' : 'Vous pourrez tout modifier plus tard.'}
      size="md"
      footer={
        step === 1 && (
          <>
            <Button variant="ghost" onClick={() => setStep(0)}>Retour</Button>
            <Button variant="primary" loading={loading} disabled={!form?.name?.trim() || form.name.trim().length < 2} onClick={submit}>
              Créer le salon
            </Button>
          </>
        )
      }
    >
      {step === 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <button key={t.category} onClick={() => pick(t)} className="group flex items-center gap-3 rounded-xl border border-line p-3 text-left transition hover:border-accent/50 hover:bg-hover">
              <RoomIcon room={t} size="md" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="line-clamp-2 text-xs text-muted">{t.description}</div>
              </div>
            </button>
          ))}
          <p className="mt-2 text-xs text-subtle sm:col-span-2">Catégories disponibles : {Object.values(ROOM_CATEGORIES).map((c) => c.label).join(', ')}.</p>
        </div>
      ) : (
        form && <RoomForm value={form} onChange={setForm} />
      )}
    </Modal>
  );
}

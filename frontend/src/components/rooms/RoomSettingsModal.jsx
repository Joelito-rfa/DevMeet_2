import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Shield, ShieldOff, UserMinus, Crown, LogOut, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal, ConfirmModal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Tabs } from '../ui/misc';
import { RoomForm } from './CreateRoomModal';
import { api } from '../../lib/api';
import { useApp } from '../../store/app';
import { useAuth } from '../../store/auth';

const ROLE = { owner: 'Propriétaire', admin: 'Administrateur', member: 'Membre' };

export default function RoomSettingsModal({ open, onClose, room, members = [], initialTab = 'general' }) {
  const me = useAuth((s) => s.user);
  const navigate = useNavigate();
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const myRole = members.find((m) => m.id === me.id)?.role || room?.role;
  const isAdmin = ['owner', 'admin'].includes(myRole);

  useEffect(() => {
    if (open && room) {
      setForm({ name: room.name, description: room.description || '', icon: room.icon, color: room.color, isPrivate: room.isPrivate });
      setTab(isAdmin ? initialTab : 'members');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, room?.id]);

  if (!room) return null;

  const save = async () => {
    setSaving(true);
    try {
      const { room: r } = await api.patch(`/rooms/${room.id}`, form);
      useApp.getState().patchRoom(room.id, r);
      toast.success('Salon mis à jour');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const setRole = async (m, role) => {
    try {
      await api.patch(`/rooms/${room.id}/members/${m.id}`, { role });
      toast.success(`${m.displayName} est maintenant ${ROLE[role].toLowerCase()}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const runConfirm = async () => {
    try {
      if (confirm.type === 'kick') {
        await api.del(`/rooms/${room.id}/members/${confirm.member.id}`);
        toast.success(`${confirm.member.displayName} a été retiré`);
      } else if (confirm.type === 'leave') {
        await api.post(`/rooms/${room.id}/leave`);
        useApp.getState().removeRoom(room.id);
        navigate('/');
        toast.success('Vous avez quitté le salon');
      } else if (confirm.type === 'delete') {
        await api.del(`/rooms/${room.id}`);
        useApp.getState().removeRoom(room.id);
        navigate('/');
        toast.success('Salon supprimé');
      }
    } catch (e) {
      toast.error(e.message);
    }
    setConfirm(null);
  };

  const tabs = [
    ...(isAdmin ? [{ value: 'general', label: 'Général' }] : []),
    { value: 'members', label: `Membres (${members.length})` },
    { value: 'danger', label: 'Avancé' },
  ];

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        icon={Settings}
        title="Paramètres du salon"
        description={room.name}
        size="lg"
        footer={tab === 'general' && isAdmin && <Button variant="primary" loading={saving} onClick={save}>Enregistrer</Button>}
      >
        <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-5" />
        {tab === 'general' && form && <RoomForm value={form} onChange={setForm} />}
        {tab === 'members' && (
          <div className="divide-y divide-line">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2.5">
                <Avatar user={m} size="md" showStatus />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {m.displayName}
                    {m.role === 'owner' && <Crown className="size-3.5 text-warning" />}
                    {m.role === 'admin' && <Shield className="size-3.5 text-accent" />}
                    {m.id === me.id && <span className="text-xs text-subtle">(vous)</span>}
                  </div>
                  <div className="text-xs text-muted">@{m.username} · {ROLE[m.role]}</div>
                </div>
                {myRole === 'owner' && m.id !== me.id && m.role !== 'owner' && (
                  <Button size="xs" variant="ghost" icon={m.role === 'admin' ? ShieldOff : Shield} onClick={() => setRole(m, m.role === 'admin' ? 'member' : 'admin')}>
                    {m.role === 'admin' ? 'Retirer admin' : 'Promouvoir'}
                  </Button>
                )}
                {isAdmin && m.id !== me.id && m.role !== 'owner' && (myRole === 'owner' || m.role === 'member') && (
                  <Button size="xs" variant="danger" icon={UserMinus} onClick={() => setConfirm({ type: 'kick', member: m })}>
                    Retirer
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {tab === 'danger' && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 rounded-xl border border-line p-4">
              <div className="flex-1">
                <div className="font-semibold">Quitter le salon</div>
                <p className="text-sm text-muted">{myRole === 'owner' ? 'La propriété sera transférée à un autre membre.' : 'Vous pourrez revenir avec une invitation.'}</p>
              </div>
              <Button variant="danger" icon={LogOut} onClick={() => setConfirm({ type: 'leave' })}>Quitter</Button>
            </div>
            {myRole === 'owner' && (
              <div className="flex items-center gap-4 rounded-xl border border-danger/30 bg-danger/5 p-4">
                <div className="flex-1">
                  <div className="font-semibold text-danger">Supprimer le salon</div>
                  <p className="text-sm text-muted">Messages, fichiers et tableau blanc seront définitivement supprimés.</p>
                </div>
                <Button variant="danger" icon={Trash2} onClick={() => setConfirm({ type: 'delete' })}>Supprimer</Button>
              </div>
            )}
          </div>
        )}
      </Modal>
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        danger
        title={confirm?.type === 'kick' ? `Retirer ${confirm.member.displayName} ?` : confirm?.type === 'leave' ? 'Quitter le salon ?' : 'Supprimer le salon ?'}
        description={confirm?.type === 'delete' ? 'Cette action est irréversible. Pensez à exporter le tableau et la discussion avant.' : undefined}
        confirmLabel={confirm?.type === 'kick' ? 'Retirer' : confirm?.type === 'leave' ? 'Quitter' : 'Supprimer définitivement'}
      />
    </>
  );
}

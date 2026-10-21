import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, AlertTriangle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useApp } from '../store/app';
import { PageHeader } from '../components/layout/Header';
import { Avatar } from '../components/ui/Avatar';
import { RoomIcon } from '../components/ui/misc';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { fromNow } from '../lib/utils';

export default function Invite() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api.get(`/invites/${code}`).then((r) => setInvite(r.invite)).catch((e) => setError(e.message));
  }, [code]);

  const accept = async () => {
    setJoining(true);
    try {
      const { room } = await api.post(`/invites/${code}/accept`);
      useApp.getState().upsertRoom(room);
      toast.success(`Bienvenue dans « ${room.name} » !`);
      navigate(`/r/${room.id}`, { replace: true });
    } catch (e) {
      toast.error(e.message);
      setJoining(false);
    }
  };

  return (
    <>
      <PageHeader><h1 className="text-base font-semibold">Invitation</h1></PageHeader>
      <div className="relative grid flex-1 place-items-center overflow-hidden p-6">
        <div className="absolute top-1/4 left-1/3 size-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="animate-pop-in card relative w-full max-w-md p-8 text-center shadow-pop">
          {error ? (
            <>
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-danger/15 text-danger"><AlertTriangle className="size-7" /></span>
              <h2 className="mt-4 text-xl font-bold">Invitation invalide</h2>
              <p className="mt-1 text-muted">{error}</p>
              <Button className="mt-6" onClick={() => navigate('/')}>Retour à l’accueil</Button>
            </>
          ) : !invite ? (
            <Spinner className="mx-auto text-muted" />
          ) : (
            <>
              {invite.inviter && (
                <div className="mb-5 flex items-center justify-center gap-2 text-sm text-muted">
                  <Avatar user={invite.inviter} size="xs" /> <b className="text-fg">{invite.inviter.displayName}</b> vous invite à rejoindre
                </div>
              )}
              <RoomIcon room={invite.room} size="xl" className="mx-auto" />
              <h2 className="mt-4 text-2xl font-bold">{invite.room.name}</h2>
              {invite.room.description && <p className="mt-1 text-muted">{invite.room.description}</p>}
              <div className="mt-4 flex items-center justify-center gap-4 text-sm text-muted">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" /> {invite.room.onlineCount} en ligne</span>
                <span className="flex items-center gap-1.5"><Users className="size-4" /> {invite.room.memberCount} membres</span>
              </div>
              {invite.alreadyMember ? (
                <Button variant="primary" size="lg" className="mt-8 w-full" icon={ArrowRight} onClick={() => navigate(`/r/${invite.room.id}`)}>Vous êtes déjà membre — ouvrir</Button>
              ) : invite.valid ? (
                <Button variant="primary" size="lg" className="mt-8 w-full" loading={joining} onClick={accept}>Rejoindre le salon</Button>
              ) : (
                <p className="mt-8 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">Cette invitation a expiré ou a été révoquée.</p>
              )}
              {invite.expiresAt && invite.valid && <p className="mt-3 text-xs text-subtle">Expire {fromNow(invite.expiresAt)}</p>}
            </>
          )}
        </div>
      </div>
    </>
  );
}

import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useApp } from '../store/app';
import { PageHeader, NotificationRow } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/misc';

export default function Notifications() {
  const notifications = useApp((s) => s.notifications);
  const { markAllNotificationsRead, markNotificationRead, clearNotifications } = useApp.getState();
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.readAt).length;
  return (
    <>
      <PageHeader><h1 className="text-base font-semibold">Notifications</h1></PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4 lg:p-8">
          <div className="mb-4 flex items-center gap-2">
            <p className="flex-1 text-sm text-muted">{unread ? `${unread} notification(s) non lue(s)` : 'Tout est lu'}</p>
            <Button size="sm" icon={CheckCheck} onClick={markAllNotificationsRead} disabled={!unread}>Tout marquer comme lu</Button>
            <Button size="sm" variant="ghost" icon={Trash2} onClick={clearNotifications} disabled={!notifications.length}>Vider</Button>
          </div>
          <div className="card p-2">
            {notifications.length ? (
              notifications.map((n) => (
                <NotificationRow key={n.id} n={n} onClick={() => { markNotificationRead(n.id); if (n.roomId) navigate(`/r/${n.roomId}`); }} />
              ))
            ) : (
              <EmptyState icon={Bell} title="Aucune notification" description="Les mentions (@vous), messages privés et invitations acceptées apparaîtront ici." />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

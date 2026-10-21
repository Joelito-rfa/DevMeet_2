import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { useApp } from '../../store/app';
import { useAuth } from '../../store/auth';
import { cn } from '../../lib/utils';

/**
 * Statut d'un message envoyé :
 * en attente → envoyé (une coche) → reçu (deux coches grises) → vu (deux coches colorées).
 * Dans un salon de groupe, « vu » signifie lu par tous les membres.
 */
export function useMessageStatus(message) {
  const me = useAuth((s) => s.user);
  const details = useApp((s) => s.details[message.roomId]);
  const users = useApp((s) => s.users);
  if (message.status === 'failed') return { status: 'failed' };
  if (!message.id) return { status: 'pending' };
  if (!details) return { status: 'sent', readers: [] };
  const others = details.members.filter((m) => m.id !== me.id);
  const receipts = details.receipts;
  const readers = others.filter((m) => (receipts[m.id]?.lastReadMessageId || 0) >= message.id);
  const deliveredTo = others.filter((m) => (receipts[m.id]?.lastDeliveredMessageId || 0) >= message.id);
  let status = 'sent';
  if (others.length && readers.length === others.length) status = 'read';
  else if (others.length && deliveredTo.length === others.length) status = 'delivered';
  return { status, readers: readers.map((m) => users[m.id] || m), deliveredTo, total: others.length };
}

const LABEL = { pending: 'Envoi…', sent: 'Envoyé', delivered: 'Reçu', read: 'Vu', failed: 'Échec de l’envoi' };

export default function MessageStatus({ message, showLabel }) {
  const { status, readers = [], deliveredTo = [], total } = useMessageStatus(message);
  const Icon = { pending: Clock, sent: Check, delivered: CheckCheck, read: CheckCheck, failed: AlertCircle }[status];
  let title = LABEL[status];
  if (total > 1 && status !== 'pending' && status !== 'failed') {
    title = readers.length ? `Vu par ${readers.map((r) => r.displayName).join(', ')}` : `Reçu par ${deliveredTo.length}/${total}`;
  }
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 text-[11px]', status === 'read' ? 'text-info' : status === 'failed' ? 'text-danger' : 'text-subtle')}>
      <Icon className={cn('size-3.5', status === 'pending' && 'animate-pulse')} />
      {showLabel && (total > 1 && status !== 'read' && readers.length ? `Vu par ${readers.length}` : LABEL[status])}
    </span>
  );
}

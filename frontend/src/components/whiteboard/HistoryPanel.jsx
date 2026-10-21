import { useEffect, useState } from 'react';
import { History, X, Save, RotateCcw, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import BoardPreview from './BoardPreview';
import { cn, formatFull, fromNow } from '../../lib/utils';

export default function HistoryPanel({ roomId, onClose, readOnly }) {
  const [versions, setVersions] = useState(null);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/rooms/${roomId}/board/versions`).then((r) => setVersions(r.versions));
  useEffect(() => {
    load().catch(() => setVersions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (!selected) return setPreview(null);
    api.get(`/rooms/${roomId}/board/versions/${selected}`).then((r) => setPreview(Object.fromEntries(r.version.elements.map((e) => [e.id, e]))));
  }, [selected, roomId]);

  const save = async () => {
    const label = prompt('Nom de la version', `Version du ${new Date().toLocaleString('fr-FR')}`);
    if (label === null) return;
    setBusy(true);
    try {
      await api.post(`/rooms/${roomId}/board/versions`, { label: label || undefined });
      await load();
      toast.success('Version enregistrée');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      await api.post(`/rooms/${roomId}/board/versions/${selected}/restore`);
      toast.success('Version restaurée pour tous les participants');
      await load();
      setSelected(null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-slide-up absolute top-3 right-3 bottom-3 z-30 flex w-[330px] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-pop">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <History className="size-4 text-accent" />
        <h3 className="flex-1 text-sm font-semibold">Historique du tableau</h3>
        <button onClick={onClose} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg"><X className="size-4" /></button>
      </div>
      {selected && (
        <div className="border-b border-line p-3">
          <div className="overflow-hidden rounded-xl border border-line">
            {preview ? <BoardPreview elements={preview} width={300} height={170} /> : <div className="h-[170px] animate-pulse bg-panel-2" />}
          </div>
          {!readOnly && <Button variant="primary" size="sm" icon={RotateCcw} className="mt-2 w-full" loading={busy} onClick={restore}>Restaurer cette version</Button>}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {versions === null && <p className="p-4 text-center text-sm text-muted">Chargement…</p>}
        {versions?.length === 0 && (
          <div className="p-6 text-center text-sm text-muted">
            <Clock className="mx-auto mb-2 size-6 text-subtle" />
            Aucune version pour l’instant. Les sauvegardes automatiques sont créées toutes les 10 minutes d’activité.
          </div>
        )}
        <ol className="relative">
          {versions?.map((v, i) => (
            <li key={v.id}>
              <button onClick={() => setSelected(selected === v.id ? null : v.id)} className={cn('relative flex w-full gap-3 rounded-xl p-2.5 text-left transition hover:bg-hover', selected === v.id && 'bg-selected ring-1 ring-line')}>
                <div className="flex flex-col items-center">
                  <span className={cn('mt-1 size-2.5 rounded-full', i === 0 ? 'bg-accent' : 'bg-line-strong')} />
                  {i < versions.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{v.label}</div>
                  <div className="mt-0.5 text-xs text-muted" title={formatFull(v.createdAt)}>{fromNow(v.createdAt)} · {v.elementCount} élément(s)</div>
                  {v.author && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-subtle">
                      <Avatar user={v.author} size="xs" /> {v.author.displayName}
                    </div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ol>
      </div>
      {!readOnly && (
        <div className="border-t border-line p-3">
          <Button size="sm" className="w-full" icon={Save} loading={busy} onClick={save}>Enregistrer la version actuelle</Button>
        </div>
      )}
    </div>
  );
}

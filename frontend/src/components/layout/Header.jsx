import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { create } from 'zustand';
import {
  Search, Bell, HelpCircle, ChevronDown, Menu, User, Settings, LogOut, Moon, Sun, Check, Smile, CheckCheck, Trash2,
  AtSign, MessageSquare, UserPlus, Target, BookOpen, Laptop, Coffee, Headphones, House,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../store/auth';
import { useApp } from '../../store/app';
import { useTheme } from '../../lib/theme';
import { api } from '../../lib/api';
import { Avatar, StatusDot, useUserStatus } from '../ui/Avatar';
import { IconButton } from '../ui/Button';
import { Popover, MenuItem, MenuSeparator, MenuLabel } from '../ui/Popover';
import { Modal } from '../ui/Modal';
import { Kbd } from '../ui/misc';
import { cn, fromNow, STATUS } from '../../lib/utils';

export const usePalette = create((set) => ({ open: false, setOpen: (open) => set({ open }) }));

export function PageHeader({ children, className }) {
  const ctx = useOutletContext();
  return (
    <header className={cn('flex h-16 shrink-0 items-center gap-3 border-b border-line bg-panel/80 px-4 backdrop-blur lg:px-6', className)}>
      <IconButton icon={Menu} label="Menu" onClick={ctx?.openSidebar} className="lg:hidden" />
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      <HeaderActions />
    </header>
  );
}

function HeaderActions() {
  const setOpen = usePalette((s) => s.setOpen);
  const [help, setHelp] = useState(false);
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        onClick={() => setOpen(true)}
        className="focus-ring hidden h-9 items-center gap-2 rounded-xl border border-line bg-input px-3 text-sm text-subtle transition hover:border-line-strong hover:text-muted xl:flex"
      >
        <Search className="size-4" />
        <span className="w-32 text-left">Rechercher…</span>
        <Kbd>Ctrl K</Kbd>
      </button>
      <IconButton icon={Search} label="Rechercher" onClick={() => setOpen(true)} className="max-sm:hidden xl:hidden" />
      <span className="max-sm:hidden"><NotificationsPopover /></span>
      <IconButton icon={HelpCircle} label="Aide & raccourcis" onClick={() => setHelp(true)} className="max-sm:hidden" />
      <UserMenu />
      <HelpModal open={help} onClose={() => setHelp(false)} />
    </div>
  );
}

const NOTIF_ICON = { mention: AtSign, dm: MessageSquare, invite_accepted: UserPlus };

export function NotificationRow({ n, onClick }) {
  const Icon = NOTIF_ICON[n.type] || Bell;
  return (
    <button onClick={onClick} className={cn('flex w-full gap-3 rounded-xl p-2.5 text-left transition hover:bg-hover', !n.readAt && 'bg-accent-soft/60')}>
      <div className="relative">
        <Avatar user={n.actor} size="md" />
        <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-accent text-on-accent ring-2 ring-elevated">
          <Icon className="size-3" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <b className="font-semibold">{n.actor?.displayName || 'Quelqu’un'}</b>{' '}
          <span className="text-muted">
            {n.type === 'mention' ? `vous a mentionné dans ${n.room?.name}` : n.type === 'dm' ? 'vous a envoyé un message' : n.type === 'invite_accepted' ? `a rejoint ${n.room?.name}` : ''}
          </span>
        </p>
        {n.content && n.type !== 'invite_accepted' && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{n.content}</p>}
        <p className="mt-1 text-[11px] text-subtle">{fromNow(n.createdAt)}</p>
      </div>
      {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
    </button>
  );
}

function NotificationsPopover() {
  const notifications = useApp((s) => s.notifications);
  const markAll = useApp((s) => s.markAllNotificationsRead);
  const markOne = useApp((s) => s.markNotificationRead);
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.readAt).length;
  return (
    <Popover
      className="w-[380px] max-w-[calc(100vw-16px)]"
      trigger={({ toggle, open }) => <IconButton icon={Bell} label="Notifications" onClick={toggle} active={open} badge={unread} />}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="font-semibold">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                <CheckCheck className="size-3.5" /> Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted">
                <Bell className="mx-auto mb-2 size-6 text-subtle" />
                Vous êtes à jour
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onClick={() => {
                    markOne(n.id);
                    close();
                    if (n.roomId) navigate(`/r/${n.roomId}`);
                  }}
                />
              ))
            )}
          </div>
          <Link to="/notifications" onClick={close} className="block border-t border-line py-2.5 text-center text-sm font-medium text-accent hover:bg-hover">
            Voir toutes les notifications
          </Link>
        </div>
      )}
    </Popover>
  );
}

export function UserMenu() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logout);
  const status = useUserStatus(user?.id);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [customOpen, setCustomOpen] = useState(false);

  const setStatus = async (preferredStatus) => {
    try {
      const { user: u } = await api.patch('/users/me', { preferredStatus });
      setUser(u);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <Popover
        className="w-72 p-1.5"
        trigger={({ toggle, open }) => (
          <button onClick={toggle} className={cn('focus-ring ml-1 flex items-center gap-2.5 rounded-xl py-1 pr-2 pl-1 transition hover:bg-hover', open && 'bg-hover')}>
            <Avatar user={user} size="md" showStatus />
            <div className="hidden text-left leading-tight md:block">
              <div className="max-w-[140px] truncate text-sm font-semibold">{user?.displayName}</div>
              <div className="flex items-center gap-1 text-[11px] text-muted">
                <span className="size-1.5 rounded-full" style={{ background: STATUS[status]?.color }} />
                {user?.customStatus || STATUS[status]?.label}
              </div>
            </div>
            <ChevronDown className="hidden size-4 text-muted md:block" />
          </button>
        )}
      >
        {(close) => (
          <div>
            <div className="flex items-center gap-3 rounded-lg p-2.5">
              <Avatar user={user} size="lg" showStatus />
              <div className="min-w-0">
                <div className="truncate font-semibold">{user?.displayName}</div>
                <div className="truncate text-xs text-muted">@{user?.username}</div>
              </div>
            </div>
            <MenuItem icon={Smile} onClick={() => { close(); setCustomOpen(true); }}>
              {user?.customStatus ? `« ${user.customStatus} »` : 'Définir un statut personnalisé'}
            </MenuItem>
            <MenuSeparator />
            <MenuLabel>Statut</MenuLabel>
            {['online', 'idle', 'dnd', 'invisible'].map((s) => (
              <MenuItem
                key={s}
                onClick={() => setStatus(s)}
                right={user?.preferredStatus === s && <Check className="size-4 text-accent" />}
                icon={() => <span className="relative mx-1 size-2.5"><StatusDot status={s} size="xs" className="!static !border-0 !size-2.5" /></span>}
              >
                <span>{STATUS[s].label}</span>
                {s === 'invisible' && <span className="block text-[11px] text-subtle">Vous apparaissez hors ligne</span>}
                {s === 'dnd' && <span className="block text-[11px] text-subtle">Notifications silencieuses</span>}
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem icon={User} onClick={() => { close(); navigate('/settings/profile'); }}>Mon profil</MenuItem>
            <MenuItem icon={Settings} onClick={() => { close(); navigate('/settings'); }}>Paramètres</MenuItem>
            <MenuItem icon={theme === 'light' ? Moon : Sun} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
              {theme === 'light' ? 'Thème sombre' : 'Thème clair'}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={LogOut} danger onClick={logout}>Déconnexion</MenuItem>
          </div>
        )}
      </Popover>
      <CustomStatusModal open={customOpen} onClose={() => setCustomOpen(false)} />
    </>
  );
}

const STATUS_PRESETS = [
  { icon: Target, label: 'Concentré' },
  { icon: BookOpen, label: 'En révision' },
  { icon: Laptop, label: 'En train de coder' },
  { icon: Coffee, label: 'En pause' },
  { icon: Headphones, label: 'En réunion' },
  { icon: House, label: 'Télétravail' },
];

function CustomStatusModal({ open, onClose }) {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [value, setValue] = useState(user?.customStatus || '');
  const save = async (v) => {
    try {
      const { user: u } = await api.patch('/users/me', { customStatus: v || null });
      setUser(u);
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Statut personnalisé"
      description="Indiquez à votre équipe ce que vous faites."
      icon={Smile}
      size="sm"
      footer={
        <>
          {user?.customStatus && (
            <button onClick={() => save(null)} className="mr-auto text-sm text-danger hover:underline">
              Effacer
            </button>
          )}
          <button onClick={() => save(value.trim())} className="h-9 rounded-xl bg-accent px-4 text-sm font-medium text-on-accent transition hover:bg-accent-hover">
            Enregistrer
          </button>
        </>
      }
    >
      <input className="input" maxLength={128} autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex : Concentré jusqu’à 17h" onKeyDown={(e) => e.key === 'Enter' && save(value.trim())} />
      <div className="mt-3 flex flex-wrap gap-2">
        {STATUS_PRESETS.map(({ icon: Icon, label }) => (
          <button key={label} onClick={() => setValue(label)} className="flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-3 py-1 text-xs text-muted transition hover:border-accent/50 hover:text-fg">
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
    </Modal>
  );
}

const SHORTCUTS = [
  ['Rechercher', 'Ctrl K'],
  ['Envoyer un message', 'Entrée'],
  ['Nouvelle ligne', 'Maj Entrée'],
  ['Sélection', 'V'],
  ['Main (déplacer la vue)', 'H / Espace'],
  ['Crayon / Pinceau', 'P / B'],
  ['Gomme', 'E'],
  ['Ligne / Flèche', 'L / A'],
  ['Rectangle / Cercle', 'R / O'],
  ['Texte / Post-it', 'T / N'],
  ['Annuler / Rétablir', 'Ctrl Z / Ctrl Y'],
  ['Dupliquer', 'Ctrl D'],
  ['Copier / Coller', 'Ctrl C / Ctrl V'],
  ['Tout sélectionner', 'Ctrl A'],
  ['Supprimer la sélection', 'Suppr'],
  ['Zoom', 'Ctrl + molette'],
  ['Ajuster à l’écran', 'Maj 1'],
];

export function HelpModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Aide & raccourcis clavier" icon={HelpCircle} size="md">
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {SHORTCUTS.map(([label, keys]) => (
          <div key={label} className="flex items-center justify-between border-b border-line/60 py-2 text-sm">
            <span className="text-muted">{label}</span>
            <Kbd>{keys}</Kbd>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        Astuce : tapez <b className="text-fg">@pseudo</b> dans un message pour mentionner quelqu’un, ou <b className="text-fg">@tous</b> pour notifier tout le salon.
      </p>
    </Modal>
  );
}

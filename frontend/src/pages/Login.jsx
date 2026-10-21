import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, LogIn, Lock, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../store/auth';
import { Button } from '../components/ui/Button';
import { Input, Label, FieldError } from '../components/ui/Input';
import { cn } from '../lib/utils';
import { easeOut, staggerChild, staggerParent } from '../lib/motion';
import AuthLayout from './AuthLayout';

// Apparition + secousse latérale quand une erreur de connexion arrive.
const errorIn = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, x: [0, -9, 8, -5, 4, 0] },
  exit: { opacity: 0, y: -6, scale: 0.98 },
  transition: { duration: 0.42, ease: easeOut },
};

// Champ avec icône : l'icône et le libellé s'allument, un trait animé souligne le focus.
function Field({ icon: Icon, label, hint, trailing, className, ...props }) {
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);

  // Le champ peut déjà porter le focus au montage (autoFocus) sans émettre d'événement.
  useEffect(() => {
    if (ref.current && document.activeElement === ref.current) setFocused(true);
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Label className={cn('transition-colors duration-300', focused && 'text-accent')}>{label}</Label>
        {hint}
      </div>
      <div className="relative">
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 transition-all duration-300',
            focused ? 'scale-110 text-accent' : 'text-subtle',
          )}
        >
          <Icon className="size-4" />
        </span>
        <Input
          ref={ref}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          className={cn('!pl-10', className)}
        />
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-x-4 bottom-1 h-px origin-center bg-gradient-to-r from-transparent via-accent to-transparent"
          animate={{ scaleX: focused ? 1 : 0, opacity: focused ? 1 : 0 }}
          transition={{ duration: 0.35, ease: easeOut }}
        />
        {trailing}
      </div>
    </div>
  );
}

export default function Login() {
  const login = useAuth((s) => s.login);
  const location = useLocation();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.identifier, form.password);
      toast.success(`Bon retour, ${user.displayName.split(' ')[0]} !`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const demo = (u) => setForm({ identifier: u, password: 'devmeet123' });

  return (
    <AuthLayout>
      <motion.div variants={staggerParent} initial="hidden" animate="show">
        <motion.h2 variants={staggerChild} className="text-3xl font-bold tracking-tight">
          Connexion
        </motion.h2>
        <motion.p variants={staggerChild} className="mt-2 text-sm text-muted">
          Heureux de vous revoir ! Connectez-vous pour rejoindre vos salons.
        </motion.p>
        <motion.form variants={staggerChild} onSubmit={submit} className="mt-8 space-y-4">
          <Field
            icon={UserRound}
            label="E-mail ou nom d’utilisateur"
            autoFocus
            autoComplete="username"
            value={form.identifier}
            onChange={(e) => setForm({ ...form, identifier: e.target.value })}
            placeholder="vous@exemple.com"
          />
          <Field
            icon={Lock}
            label="Mot de passe"
            className="!pr-11"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            trailing={
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute top-1/2 right-2.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-subtle transition hover:bg-hover hover:text-fg"
                aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={show ? 'on' : 'off'}
                    initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.6, rotate: 30 }}
                    transition={{ duration: 0.18, ease: easeOut }}
                    className="grid size-4 place-items-center"
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </motion.span>
                </AnimatePresence>
              </button>
            }
          />
          <AnimatePresence mode="wait">
            {error && (
              <motion.p
                key={error}
                {...errorIn}
                className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <div className="group relative">
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading} icon={LogIn}>
              Se connecter
            </Button>
            <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
              <motion.span
                className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/10 blur-md"
                animate={{ x: ['0%', '420%'] }}
                transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 3.4, ease: 'easeInOut' }}
              />
            </span>
          </div>
        </motion.form>
        <motion.p variants={staggerChild} className="mt-6 text-center text-sm text-muted">
          Pas encore de compte ?{' '}
          <Link to={`/register${location.search}`} className="font-semibold text-accent hover:underline">
            Créer un compte
          </Link>
        </motion.p>
        <motion.div variants={staggerChild} className="mt-8 rounded-2xl border border-dashed border-line p-4">
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Comptes de démonstration</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {['alice', 'bob', 'claire', 'david'].map((u, i) => (
              <motion.button
                key={u}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.05, duration: 0.3, ease: easeOut }}
                whileHover={{ scale: 1.06, y: -1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => demo(u)}
                className="rounded-full border border-line bg-panel-2 px-3 py-1 text-xs font-medium capitalize transition hover:border-accent/50 hover:text-accent"
              >
                {u}
              </motion.button>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-subtle">
            <ShieldCheck className="size-3.5 shrink-0" />
            Mot de passe : <code className="font-mono">devmeet123</code> — ouvrez deux navigateurs pour tester la collaboration.
          </p>
        </motion.div>
      </motion.div>
    </AuthLayout>
  );
}

// Re-export to keep FieldError import tree-shaken when unused elsewhere
export { FieldError };

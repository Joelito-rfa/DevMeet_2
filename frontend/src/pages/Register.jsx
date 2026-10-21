import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../store/auth';
import { Button } from '../components/ui/Button';
import { Input, Label } from '../components/ui/Input';
import { pop, staggerChild, staggerParent } from '../lib/motion';
import { statusColors } from '../lib/tokens';
import AuthLayout from './AuthLayout';

function strength(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 14) s++;
  return s;
}

const strengthColors = [statusColors.dnd, statusColors.idle, 'var(--info)', statusColors.online];

export default function Register() {
  const register = useAuth((s) => s.register);
  const location = useLocation();
  const [form, setForm] = useState({ displayName: '', username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'displayName' && (!f.username || f.username === slug(f.displayName))) next.username = slug(v);
      return next;
    });
  };
  const slug = (v) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9_.]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 32);
  const s = strength(form.password);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      toast.success('Bienvenue sur DevMeet !');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <motion.div variants={staggerParent} initial="hidden" animate="show">
        <motion.h2 variants={staggerChild} className="text-3xl font-bold tracking-tight">
          Créer un compte
        </motion.h2>
        <motion.p variants={staggerChild} className="mt-2 text-sm text-muted">
          Rejoignez votre équipe en moins d’une minute.
        </motion.p>
        <motion.form variants={staggerChild} onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <Label>Nom affiché</Label>
            <Input autoFocus value={form.displayName} onChange={set('displayName')} placeholder="Alice Martin" />
          </div>
          <div>
            <Label>Nom d’utilisateur</Label>
            <div className="relative">
              <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-subtle">@</span>
              <Input className="!pl-8" value={form.username} onChange={set('username')} placeholder="alice" />
            </div>
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder="vous@exemple.com" />
          </div>
          <div>
            <Label>Mot de passe</Label>
            <Input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="8 caractères minimum" />
            <div className="mt-2 flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: i < s ? '100%' : '0%', backgroundColor: i < s ? strengthColors[s - 1] : 'transparent' }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
              ))}
            </div>
          </div>
          <AnimatePresence mode="wait">
            {error && (
              <motion.p
                key={error}
                {...pop}
                className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading} icon={UserPlus}>
            Créer mon compte
          </Button>
        </motion.form>
        <motion.p variants={staggerChild} className="mt-6 text-center text-sm text-muted">
          Déjà inscrit ?{' '}
          <Link to={`/login${location.search}`} className="font-semibold text-accent hover:underline">
            Se connecter
          </Link>
        </motion.p>
      </motion.div>
    </AuthLayout>
  );
}

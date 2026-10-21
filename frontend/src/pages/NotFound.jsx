import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/Header';

export default function NotFound() {
  return (
    <>
      <PageHeader />
      <div className="grid flex-1 place-items-center p-8 text-center">
        <div>
          <p className="gradient-text text-7xl font-extrabold">404</p>
          <h1 className="mt-2 text-xl font-semibold">Page introuvable</h1>
          <p className="mt-1 text-muted">Cette page n’existe pas ou a été déplacée.</p>
          <Link to="/" className="mt-6 inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-on-accent">Retour à l’accueil</Link>
        </div>
      </div>
    </>
  );
}

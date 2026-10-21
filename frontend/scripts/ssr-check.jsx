import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import AuthShowcase from '../src/pages/AuthShowcase';
import Login from '../src/pages/Login';
import Register from '../src/pages/Register';

const fails = [];
const expect = (cond, msg) => {
  if (!cond) fails.push(msg);
};

const loginHtml = renderToString(
  <MemoryRouter>
    <Login />
  </MemoryRouter>,
);
expect(loginHtml.includes('Connexion'), 'login: titre manquant');
expect(loginHtml.includes('Comptes de démonstration'), 'login: bloc démo manquant');
expect(loginHtml.includes('Concevez ensemble'), 'login: aperçu du carrousel manquant');
expect(loginHtml.includes('Afficher le mot de passe'), 'login: bouton oeil manquant');
expect(loginHtml.includes('Passer au thème'), 'login: bascule de thème manquante');
expect((loginHtml.match(/role="tab"/g) || []).length === 3, 'login: il faut exactement 3 indicateurs de slide');

const scenes = [0, 1, 2].map((i) => renderToString(<AuthShowcase initialIndex={i} />));
expect(scenes[0].includes('Idées du projet'), 'scene 1: tableau manquant');
expect(scenes[1].includes('equipe-front'), 'scene 2: chat manquant');
expect(scenes[1].includes('typing-dot'), 'scene 2: indicateur de saisie manquant');
expect(scenes[2].includes('Design review'), 'scene 3: salon vocal manquant');
expect(scenes[2].includes('speaking-ring'), 'scene 3: anneau de parole manquant');

const regHtml = renderToString(
  <MemoryRouter>
    <Register />
  </MemoryRouter>,
);
expect(regHtml.includes('Créer un compte'), 'register: contenu manquant');
expect(regHtml.includes('Concevez ensemble'), 'register: aperçu manquant');

console.log('login html:', loginHtml.length, 'chars · scene lengths:', scenes.map((s) => s.length).join(', '));

if (fails.length) {
  console.error('ECHEC:\n- ' + fails.join('\n- '));
  process.exit(1);
}
console.log('OK: toutes les vérifications passent');

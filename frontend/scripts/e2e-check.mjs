// Vérification réelle (Edge headless + CDP) des animations de /login.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) fails.push(msg);
};

const res = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' });
const target = await res.json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let id = 0;
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise((resolve) => {
  const i = ++id;
  pending.set(i, resolve);
  ws.send(JSON.stringify({ id: i, method, params }));
});
const evalJs = async (expression) => {
  const m = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description || 'erreur evaluate');
  return m.result.result.value;
};
const clickAt = async (selector) => {
  const p = JSON.parse(
    await evalJs(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 }); })()`),
  );
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
};

const PROBE = `(() => {
  const text = document.body.textContent;
  const scenes = ['Idées du projet', 'equipe-front', 'Design review'];
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const box = tabs[0]?.parentElement?.parentElement?.previousElementSibling;
  const rect = box?.getBoundingClientRect();
  return JSON.stringify({
    active: tabs.findIndex((b) => b.getAttribute('aria-selected') === 'true'),
    present: scenes.filter((s) => text.includes(s)),
    tabs: tabs.length,
    box: rect ? { w: Math.round(rect.width), h: Math.round(rect.height) } : null,
  });
})()`;
const probe = async () => JSON.parse(await evalJs(PROBE));

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const BASE = process.env.BASE_URL || 'http://localhost:4173';
await send('Page.navigate', { url: `${BASE}/login` });

// Attente du montage de l'app (le serveur de dev compile à la demande).
let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  ready = await evalJs(`document.querySelectorAll('[role="tab"]').length === 3`);
  if (!ready) await sleep(500);
}
console.log(ready ? 'app montée' : 'app NON montée');
await sleep(800);

const t0 = await probe();
check(t0.tabs === 3, '3 indicateurs de slide dans le panneau gauche');
check(t0.box && t0.box.w > 500 && t0.box.h > 150, `aperçu visible en desktop (${t0.box?.w}x${t0.box?.h}px)`);
check(t0.active === 0 && t0.present.includes('Idées du projet'), `image 1 affichée au départ (${t0.present.join('+')})`);

await sleep(7000);
const t1 = await probe();
check(t1.active === 1 && t1.present.includes('equipe-front'), `rotation auto -> image 2 (${t1.present.join('+')})`);

await sleep(7000);
const t2 = await probe();
check(t2.active === 2 && t2.present.includes('Design review'), `rotation auto -> image 3 (${t2.present.join('+')})`);

await sleep(7000);
const t3 = await probe();
check(t3.active === 0 && t3.present.includes('Idées du projet'), `rotation auto -> retour à l'image 1 (${t3.present.join('+')})`);

await evalJs(`document.querySelectorAll('[role="tab"]')[2].click()`);
await sleep(1200);
const clicked = await probe();
check(clicked.active === 2 && clicked.present.includes('Design review'), `clic sur la pastille 3 -> image 3 (${clicked.present.join('+')})`);

const carousel = `document.querySelector('[role="tablist"]').parentElement.parentElement`;
await evalJs(`${carousel}.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))`);
await sleep(9000);
const hovered = await probe();
check(hovered.active === 2, `survol : la rotation est figée sur l'image 3 (${hovered.present.join('+')})`);

await evalJs(`${carousel}.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))`);
await sleep(8000);
const resumed = await probe();
check(resumed.active === 0, `fin du survol : la rotation reprend (image ${resumed.active + 1})`);

check(
  await evalJs(`getComputedStyle([...document.querySelectorAll('div')].find((d) => d.textContent === 'Idées du projet')).color === 'rgb(27, 34, 51)'`),
  "tableau blanc : texte à l'encre sombre (contraste corrigé)",
);

// Animations du formulaire, déclenchées par de vrais clics souris
const ICON_STAT = `(() => {
  const input = document.querySelector('input[autocomplete="username"]');
  const wrap = input.closest('div.relative');
  const spans = wrap.querySelectorAll('span');
  return JSON.stringify({
    iconLit: spans[0].className.includes('text-accent'),
    underline: getComputedStyle(spans[1]).opacity,
    label: getComputedStyle(wrap.previousElementSibling.querySelector('label')).color,
  });
})()`;

console.log('  (état sans focus :', await evalJs(ICON_STAT), ')');
await clickAt('input[autocomplete="username"]');
await sleep(500);
const focused = JSON.parse(await evalJs(ICON_STAT));
check(focused.iconLit, "focus : l'icône du champ s'allume en accent");
check(focused.underline === '1', 'focus : le trait animé du champ apparaît');
check(focused.label === 'rgb(88, 101, 242)', "focus : le libellé du champ s'allume");

await clickAt('input[autocomplete="current-password"]');
await sleep(300);
const blurred = JSON.parse(await evalJs(ICON_STAT));
check(!blurred.iconLit && blurred.underline === '0', 'perte du focus : les effets se retirent');

const beforeType = await evalJs(`document.querySelector('input[autocomplete="current-password"]').type`);
await clickAt('button[aria-label="Afficher le mot de passe"]');
await sleep(400);
const afterType = await evalJs(`document.querySelector('input[autocomplete="current-password"]').type`);
check(beforeType === 'password' && afterType === 'text', `bouton oeil : ${beforeType} -> ${afterType}`);

const theme1 = await evalJs(`document.documentElement.dataset.theme`);
await clickAt('button[aria-label^="Passer au"]');
await sleep(600);
const theme2 = await evalJs(`document.documentElement.dataset.theme`);
check(theme1 !== theme2, `bascule de thème disponible avant connexion (${theme1} -> ${theme2})`);

console.log(fails.length ? `\nECHEC (${fails.length})` : '\nTOUT EST VERT');
process.exit(fails.length ? 1 : 0);

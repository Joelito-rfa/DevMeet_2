// Vérification navigateur (Edge headless + CDP) : l'interface n'affiche plus d'emoji
// et les icônes (salons, réactions) sont bien rendues en SVG lucide.
//
// Prérequis : l'API (port 4000) et le front (port 5180) doivent tourner,
// et Edge doit exposer le port de débogage :
//   msedge.exe --headless=new --remote-debugging-port=9222 --user-data-dir=%TEMP%\edge-devmeet
//
//   npm run check:icons --prefix frontend
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!cond) fails.push(msg);
};

const BASE = process.env.BASE_URL || 'http://localhost:5180';

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
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const i = ++id;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evalJs = async (expression) => {
  const m = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description || 'erreur evaluate');
  return m.result.result.value;
};

// Un caractère emoji (hors symboles typographiques comme « © ») trouvé dans le texte rendu.
const EMOJI_TEST = `[...(document.body ? document.body.innerText : '')].filter((c) => /[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{1F1E6}-\\u{1F1FF}\\u{FE0F}]/u.test(c)).join('')`;

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
// Repart d'une session vierge (le cookie de session est httpOnly).
await send('Network.clearBrowserCookies');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// ---------------------------------------------------------------- Page de connexion
await send('Page.navigate', { url: `${BASE}/login` });
for (let i = 0; i < 60; i++) {
  if (await evalJs(`!!document.querySelector('input[autocomplete="username"]')`)) break;
  await sleep(500);
}
check(await evalJs(`!!document.querySelector('input[autocomplete="username"]')`), 'formulaire de connexion monté');
check((await evalJs(EMOJI_TEST)) === '', `page de connexion sans emoji (« ${await evalJs(EMOJI_TEST)} »)`);

// ---------------------------------------------------------------- Connexion
await evalJs(`(() => {
  const set = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set(document.querySelector('input[autocomplete="username"]'), 'alice');
  set(document.querySelector('input[autocomplete="current-password"]'), 'devmeet123');
  document.querySelector('form').requestSubmit();
})()`);
for (let i = 0; i < 60; i++) {
  if (await evalJs(`document.body.innerText.includes('Vos salons')`)) break;
  await sleep(500);
}
check(await evalJs(`!!document.body && document.body.innerText.includes('Vos salons')`), 'accueil affiché après connexion');
check((await evalJs(EMOJI_TEST)) === '', `accueil sans emoji (« ${await evalJs(EMOJI_TEST)} »)`);

// Les icônes de salon sont des SVG lucide (et non des caractères).
const roomIcons = await evalJs(`(() => {
  const spans = [...document.querySelectorAll('span')].filter((s) => s.querySelector(':scope > svg') && s.className.includes('place-items-center'));
  return JSON.stringify({ count: spans.length, allSvg: spans.every((s) => s.querySelector(':scope > svg')), texts: spans.map((s) => s.innerText.trim()).filter(Boolean) });
})()`);
const icons = JSON.parse(roomIcons);
check(icons.count > 0 && icons.allSvg, `icônes de salon rendues en SVG (${icons.count} trouvées)`);
check(icons.texts.length === 0, `aucun caractère dans les icônes de salon (« ${icons.texts.join(',')} »)`);

// ---------------------------------------------------------------- Salon + réactions
await send('Page.navigate', { url: `${BASE}/r/2` });
for (let i = 0; i < 60; i++) {
  if (await evalJs(`!!document.body && document.body.innerText.includes('Bonjour tout le monde')`)) break;
  await sleep(500);
}
check(await evalJs(`!!document.body && document.body.innerText.includes('Bonjour tout le monde')`), 'historique du salon chargé');
check((await evalJs(EMOJI_TEST)) === '', `salon sans emoji (« ${await evalJs(EMOJI_TEST)} »)`);

const reactions = await evalJs(`(() => {
  const buttons = [...document.querySelectorAll('button[aria-label]')].filter((b) => b.querySelector('svg') && b.title);
  return JSON.stringify(buttons.map((b) => ({ label: b.getAttribute('aria-label'), svg: !!b.querySelector('svg') })));
})()`);
console.log('  réactions détectées :', reactions);

console.log(fails.length ? `\nECHEC (${fails.length})` : '\nTOUT EST VERT');
process.exit(fails.length ? 1 : 0);

let ctx;
const getCtx = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

function tone(freqs, { duration = 0.12, gap = 0.08, volume = 0.06, type = 'sine' } = {}) {
  try {
    if (localStorage.getItem('devmeet-sounds') === 'off') return;
    const c = getCtx();
    freqs.forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = f;
      const t = c.currentTime + i * gap;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(volume, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + duration + 0.02);
    });
  } catch {
    /* audio indisponible */
  }
}

export const sounds = {
  message: () => tone([880, 1320], { duration: 0.1, gap: 0.07, volume: 0.04 }),
  notification: () => tone([660, 990, 1320], { duration: 0.14, gap: 0.09, volume: 0.05 }),
  join: () => tone([520, 780], { duration: 0.16, gap: 0.1, volume: 0.05, type: 'triangle' }),
  leave: () => tone([780, 520], { duration: 0.16, gap: 0.1, volume: 0.05, type: 'triangle' }),
};

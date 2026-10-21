const KEY = 'devmeet-audio';

export const DEFAULT_AUDIO = {
  inputDeviceId: 'default',
  outputDeviceId: 'default',
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  /** Seuil de détection de la parole (0.01 = très sensible, 0.15 = peu sensible). */
  threshold: 0.035,
};

export function loadAudioSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_AUDIO };
    return { ...DEFAULT_AUDIO, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

export function saveAudioSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* stockage indisponible */
  }
}

export const supportsOutputSelection = () =>
  typeof window !== 'undefined' && typeof window.AudioContext !== 'undefined';

/** Vrai si le navigateur peut router l'audio vers une sortie précise (Chrome/Edge). */
export const supportsSetSinkId = () =>
  typeof window !== 'undefined' && typeof window.HTMLMediaElement !== 'undefined' && 'setSinkId' in window.HTMLMediaElement.prototype;

/**
 * Liste les micros et haut-parleurs. Si les labels sont vides (permission micro
 * jamais accordée), demande une autorisation temporaire pour les révéler.
 */
export async function listAudioDevices() {
  const split = (all) => ({
    inputs: all.filter((d) => d.kind === 'audioinput'),
    outputs: all.filter((d) => d.kind === 'audiooutput'),
  });
  if (!navigator.mediaDevices?.enumerateDevices) return { inputs: [], outputs: [] };
  let all = await navigator.mediaDevices.enumerateDevices();
  let { inputs, outputs } = split(all);
  if (inputs.length > 0 && inputs.every((d) => !d.label)) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      all = await navigator.mediaDevices.enumerateDevices();
      ({ inputs, outputs } = split(all));
    } catch {
      /* permission refusée : on garde des labels génériques */
    }
  }
  return { inputs, outputs };
}

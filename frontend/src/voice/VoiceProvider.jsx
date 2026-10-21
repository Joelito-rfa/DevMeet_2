import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { socket, emitAck } from '../lib/socket';
import { useAuth } from '../store/auth';
import { sounds } from '../lib/sound';
import { loadAudioSettings, saveAudioSettings, listAudioDevices } from '../lib/audioSettings';

const VoiceContext = createContext(null);
export const useVoice = () => useContext(VoiceContext);

const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

/**
 * Salon vocal en maillage WebRTC : chaque participant ouvre une connexion
 * pair-à-pair avec les autres. Le serveur ne fait que relayer la signalisation.
 */
export function VoiceProvider({ children }) {
  const [roomId, setRoomId] = useState(null);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [noMic, setNoMic] = useState(false);
  const [speaking, setSpeaking] = useState({});
  const [volumes, setVolumes] = useState({});
  const [audioSettings, setAudioSettingsState] = useState(loadAudioSettings);
  const [devices, setDevices] = useState({ inputs: [], outputs: [] });

  const localStream = useRef(null);
  const peers = useRef(new Map()); // socketId -> { pc, userId, audio, analyser, pendingIce }
  const audioCtx = useRef(null);
  const localAnalyser = useRef(null);
  const state = useRef({ muted: false, deafened: false, roomId: null });
  const settingsRef = useRef(audioSettings);
  useEffect(() => {
    settingsRef.current = audioSettings;
  }, [audioSettings]);

  /** Met à jour les réglages audio (persistés en local, appliqués au prochain vocal, sauf seuil et sortie). */
  const saveAudio = useCallback((patch) => {
    setAudioSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveAudioSettings(next);
      return next;
    });
  }, []);

  const refreshDevices = useCallback(async () => {
    const d = await listAudioDevices();
    setDevices(d);
    return d;
  }, []);

  // Liste les périphériques au montage (les labels apparaissent après autorisation micro).
  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  /** Route les voix distantes vers la sortie choisie (Chrome/Edge). */
  const applyOutputDevice = useCallback((deviceId) => {
    for (const p of peers.current.values()) {
      if (p.audio && typeof p.audio.setSinkId === 'function' && deviceId && deviceId !== 'default') {
        p.audio.setSinkId(deviceId).catch(() => {});
      }
    }
  }, []);

  // Applique un changement de sortie en direct, même en plein appel.
  useEffect(() => {
    if (roomId) applyOutputDevice(audioSettings.outputDeviceId);
  }, [audioSettings.outputDeviceId, applyOutputDevice, roomId]);

  /** Joue un bip de test sur la sortie sélectionnée. */
  const testSpeaker = useCallback(async () => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return toast.error('Audio indisponible dans ce navigateur');
    const c = new Ctx();
    try {
      await c.resume();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0.15;
      const dest = c.createMediaStreamDestination();
      o.connect(g).connect(dest);
      o.start();
      o.stop(c.currentTime + 0.5);
      const el = new Audio();
      el.srcObject = dest.stream;
      const out = settingsRef.current.outputDeviceId;
      if (typeof el.setSinkId === 'function' && out && out !== 'default') await el.setSinkId(out);
      await el.play();
      setTimeout(() => {
        el.srcObject = null;
        c.close().catch(() => {});
      }, 900);
    } catch {
      c.close().catch(() => {});
      toast.error('Lecture impossible sur cette sortie');
    }
  }, []);

  const ctx = () => (audioCtx.current ||= new (window.AudioContext || window.webkitAudioContext)());

  const makeAnalyser = (stream) => {
    try {
      const a = ctx().createAnalyser();
      a.fftSize = 512;
      ctx().createMediaStreamSource(stream).connect(a);
      return a;
    } catch {
      return null;
    }
  };

  const level = (analyser) => {
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += ((v - 128) / 128) ** 2;
    return Math.sqrt(sum / data.length);
  };

  const signal = (to, data) => socket.emit('voice:signal', { to, data });

  const closePeer = useCallback((socketId) => {
    const p = peers.current.get(socketId);
    if (!p) return;
    p.pc.close();
    if (p.audio) {
      p.audio.srcObject = null;
      p.audio.remove();
    }
    peers.current.delete(socketId);
  }, []);

  const createPeer = useCallback((socketId, userId, initiator) => {
    closePeer(socketId);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer = { pc, userId, audio: null, analyser: null, pendingIce: [] };
    peers.current.set(socketId, peer);

    pc.onicecandidate = (e) => e.candidate && signal(socketId, { candidate: e.candidate });
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      const audio = peer.audio || document.createElement('audio');
      audio.autoplay = true;
      audio.srcObject = stream;
      audio.muted = state.current.deafened;
      audio.volume = (volumesRef.current[userId] ?? 100) / 100;
      const out = settingsRef.current?.outputDeviceId;
      if (typeof audio.setSinkId === 'function' && out && out !== 'default') audio.setSinkId(out).catch(() => {});
      audio.dataset.voicePeer = socketId;
      if (!peer.audio) document.body.appendChild(audio);
      audio.play().catch(() => {});
      peer.audio = audio;
      peer.analyser = makeAnalyser(stream);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') pc.restartIce?.();
    };

    if (initiator) {
      const tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
      const track = localStream.current?.getAudioTracks()[0];
      if (track) tr.sender.replaceTrack(track);
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => signal(socketId, { sdp: pc.localDescription }))
        .catch(console.error);
    }
    return peer;
  }, [closePeer]);

  const volumesRef = useRef({});
  useEffect(() => {
    volumesRef.current = volumes;
  }, [volumes]);

  // Signalisation entrante
  useEffect(() => {
    const onSignal = async ({ from, userId, data }) => {
      if (!state.current.roomId) return;
      let peer = peers.current.get(from);
      try {
        if (data.sdp) {
          if (data.sdp.type === 'offer') {
            peer = createPeer(from, userId, false);
            await peer.pc.setRemoteDescription(data.sdp);
            const tr = peer.pc.getTransceivers()[0];
            if (tr) {
              tr.direction = 'sendrecv';
              const track = localStream.current?.getAudioTracks()[0];
              if (track) await tr.sender.replaceTrack(track);
            }
            const answer = await peer.pc.createAnswer();
            await peer.pc.setLocalDescription(answer);
            signal(from, { sdp: peer.pc.localDescription });
          } else if (peer) {
            await peer.pc.setRemoteDescription(data.sdp);
          }
          for (const c of peer?.pendingIce.splice(0) || []) await peer.pc.addIceCandidate(c).catch(() => {});
        } else if (data.candidate && peer) {
          if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(data.candidate).catch(() => {});
          else peer.pendingIce.push(data.candidate);
        }
      } catch (err) {
        console.error('[voice] signal', err);
      }
    };
    const onPeerLeft = ({ socketId }) => {
      closePeer(socketId);
      sounds.leave();
    };
    const onKicked = () => {
      cleanup();
      toast.info('Vocal repris dans un autre onglet');
    };
    const onReconnect = () => {
      // Après une coupure, on rejoint de nouveau le vocal automatiquement.
      const rid = state.current.roomId;
      if (rid) {
        cleanupPeers();
        emitAck('voice:join', { roomId: rid, muted: state.current.muted })
          .then(({ peers: list }) => list.forEach((p) => createPeer(p.socketId, p.userId, true)))
          .catch(() => cleanup());
      }
    };
    socket.on('voice:signal', onSignal);
    socket.on('voice:peer-left', onPeerLeft);
    socket.on('voice:kicked', onKicked);
    socket.on('connect', onReconnect);
    return () => {
      socket.off('voice:signal', onSignal);
      socket.off('voice:peer-left', onPeerLeft);
      socket.off('voice:kicked', onKicked);
      socket.off('connect', onReconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createPeer, closePeer]);

  // Détection de la parole (local + distants)
  useEffect(() => {
    if (!roomId) return;
    const me = useAuth.getState().user?.id;
    const timer = setInterval(() => {
      const threshold = settingsRef.current.threshold ?? 0.035;
      const next = {};
      if (!state.current.muted && localAnalyser.current) next[me] = level(localAnalyser.current) > threshold;
      for (const p of peers.current.values()) next[p.userId] = level(p.analyser) > threshold;
      setSpeaking((prev) => {
        const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
        for (const k of keys) if (!!prev[k] !== !!next[k]) return next;
        return prev;
      });
    }, 150);
    return () => clearInterval(timer);
  }, [roomId]);

  function cleanupPeers() {
    for (const id of [...peers.current.keys()]) closePeer(id);
  }

  function cleanup() {
    cleanupPeers();
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    localAnalyser.current = null;
    state.current.roomId = null;
    setRoomId(null);
    setSpeaking({});
  }

  const join = useCallback(
    async (targetRoomId) => {
      if (state.current.roomId === targetRoomId || joining) return;
      setJoining(true);
      if (state.current.roomId) {
        socket.emit('voice:leave');
        cleanup();
      }
      let micMissing = false;
      const s = settingsRef.current;
      const baseConstraints = {
        echoCancellation: s.echoCancellation,
        noiseSuppression: s.noiseSuppression,
        autoGainControl: s.autoGainControl,
      };
      const preferred = s.inputDeviceId && s.inputDeviceId !== 'default'
        ? { ...baseConstraints, deviceId: { exact: s.inputDeviceId } }
        : baseConstraints;
      const openMic = async (constraints) => {
        localStream.current = await navigator.mediaDevices.getUserMedia({ audio: constraints });
        localAnalyser.current = makeAnalyser(localStream.current);
      };
      try {
        await openMic(preferred);
      } catch {
        try {
          // L'appareil choisi a peut-être été débranché : repli sur le micro par défaut.
          if (preferred.deviceId) await openMic(baseConstraints);
          else throw new Error('no-mic');
        } catch {
          micMissing = true;
          toast.warning('Microphone indisponible : vous rejoignez le vocal en écoute seule.');
        }
      }
      setNoMic(micMissing);
      const startMuted = micMissing || state.current.muted;
      localStream.current?.getAudioTracks().forEach((t) => (t.enabled = !startMuted));
      try {
        const { peers: list } = await emitAck('voice:join', { roomId: targetRoomId, muted: startMuted });
        state.current.roomId = targetRoomId;
        state.current.muted = startMuted;
        setMuted(startMuted);
        setRoomId(targetRoomId);
        ctx().resume?.();
        list.forEach((p) => createPeer(p.socketId, p.userId, true));
        sounds.join();
      } catch (err) {
        toast.error(err.message || 'Impossible de rejoindre le vocal');
        cleanup();
      } finally {
        setJoining(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [joining, createPeer],
  );

  const leave = useCallback(() => {
    if (!state.current.roomId) return;
    socket.emit('voice:leave');
    cleanup();
    sounds.leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = useCallback(() => {
    if (noMic) return toast.info('Aucun microphone détecté');
    const next = !state.current.muted;
    state.current.muted = next;
    setMuted(next);
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    socket.emit('voice:state', { muted: next });
  }, [noMic]);

  const toggleDeafen = useCallback(() => {
    const next = !state.current.deafened;
    state.current.deafened = next;
    setDeafened(next);
    for (const p of peers.current.values()) if (p.audio) p.audio.muted = next;
    // Mettre le casque coupe aussi le micro, comme sur Discord.
    if (next && !state.current.muted) {
      state.current.muted = true;
      setMuted(true);
      localStream.current?.getAudioTracks().forEach((t) => (t.enabled = false));
    }
    socket.emit('voice:state', { deafened: next, muted: state.current.muted });
  }, []);

  const setUserVolume = useCallback((userId, value) => {
    setVolumes((v) => ({ ...v, [userId]: value }));
    for (const p of peers.current.values()) if (p.userId === userId && p.audio) p.audio.volume = value / 100;
  }, []);

  // Quitte proprement le vocal à la fermeture de l'onglet
  useEffect(() => {
    const onUnload = () => state.current.roomId && socket.emit('voice:leave');
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  return (
    <VoiceContext.Provider
      value={{ roomId, joining, muted, deafened, noMic, speaking, volumes, join, leave, toggleMute, toggleDeafen, setUserVolume, audioSettings, saveAudio, devices, refreshDevices, testSpeaker }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

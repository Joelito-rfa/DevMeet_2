import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn, formatDuration } from '../../lib/utils';

/** Lecteur de message vocal avec forme d'onde stylisée. */
export default function AudioPlayer({ src, duration: initialDuration, mine }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const bars = useMemo(() => {
    let seed = [...src].reduce((a, c) => a + c.charCodeAt(0), 0);
    return Array.from({ length: 36 }, () => {
      seed = (seed * 9301 + 49297) % 233280;
      return 0.25 + (seed / 233280) * 0.75;
    });
  }, [src]);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => setProgress(a.duration && Number.isFinite(a.duration) ? a.currentTime / a.duration : 0);
    const onMeta = () => Number.isFinite(a.duration) && setDuration(a.duration);
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, []);

  const toggle = () => {
    const a = audio.current;
    if (playing) a.pause();
    else {
      document.querySelectorAll('audio[data-voice-message]').forEach((x) => x !== a && x.pause());
      a.play();
    }
    setPlaying(!playing);
  };

  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (audio.current.duration) audio.current.currentTime = ratio * audio.current.duration;
  };

  return (
    <div className={cn('flex w-[260px] max-w-full items-center gap-3 rounded-2xl border px-3 py-2', mine ? 'border-accent/30 bg-accent-soft' : 'border-line bg-panel-2')}>
      <audio ref={audio} src={src} preload="metadata" data-voice-message onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
      <button onClick={toggle} className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition hover:bg-accent-hover" aria-label={playing ? 'Pause' : 'Lecture'}>
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
      </button>
      <div className="flex h-8 flex-1 cursor-pointer items-center gap-[2px]" onClick={seek}>
        {bars.map((h, i) => (
          <span key={i} className={cn('w-[3px] rounded-full transition-colors', i / bars.length < progress ? 'bg-accent' : 'bg-muted/40')} style={{ height: `${h * 100}%` }} />
        ))}
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[11px] text-muted">{formatDuration(playing ? progress * duration : duration)}</span>
    </div>
  );
}

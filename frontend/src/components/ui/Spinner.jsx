import { cn } from '../../lib/utils';

export function Spinner({ className }) {
  return (
    <svg className={cn('size-5 animate-spin', className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function FullScreenLoader({ label = 'Chargement…' }) {
  return (
    <div className="grid h-full place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.svg" alt="" className="size-12 animate-pulse" />
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  );
}

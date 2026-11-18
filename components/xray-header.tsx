'use client';

import { useEffect, useState } from 'react';

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Live / Done / Stopped with a running timer. */
export function RunStatus({
  status,
  startedAt,
  elapsedMs,
}: {
  status: 'running' | 'done' | 'error';
  startedAt: number;
  elapsedMs?: number;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (status !== 'running') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [status]);
  const ms = elapsedMs ?? Math.max(0, (status === 'running' ? now : Date.now()) - startedAt);

  return (
    <span className="flex items-center gap-2 text-muted-foreground">
      {status === 'running' && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
        </span>
      )}
      {status === 'running' ? 'Live' : status === 'done' ? 'Done' : 'Stopped'}
      <span className="tabular-nums">{fmt(ms)}</span>
    </span>
  );
}

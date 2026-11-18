'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Check, Timer, XCircle } from 'lucide-react';

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** LIVE / Complete / Stopped badge with a running timer. */
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
    <div className="flex items-center gap-3">
      {status === 'running' ? (
        <Badge className="gap-1.5 bg-rose-600 text-white hover:bg-rose-600">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          LIVE
        </Badge>
      ) : status === 'done' ? (
        <Badge variant="outline" className="gap-1 border-success/40 text-success">
          <Check className="h-3 w-3" /> Complete
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
          <XCircle className="h-3 w-3" /> Stopped
        </Badge>
      )}
      <span className="flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
        <Timer className="h-4 w-4" />
        {fmt(ms)}
      </span>
    </div>
  );
}

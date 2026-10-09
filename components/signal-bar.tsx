'use client';

import { cn } from '@/lib/utils';

interface SignalBarProps {
  label: string;
  value: number;
  description?: string;
}

export function SignalBar({ label, value, description }: SignalBarProps) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 75 ? 'bg-success' :
    pct >= 50 ? 'bg-warning' :
    'bg-destructive';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">{label}</span>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <span className="text-sm font-bold tabular-nums">{pct}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

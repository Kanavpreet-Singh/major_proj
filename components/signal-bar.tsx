'use client';

import { cn } from '@/lib/utils';

interface SignalBarProps {
  label: string;
  value: number;
  description?: string;
  subValue?: string;
  badge?: string;
}

export function SignalBar({ label, value, description, subValue, badge }: SignalBarProps) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const color =
    pct >= 70 ? 'bg-success' :
    pct >= 45 ? 'bg-warning' :
    'bg-destructive';

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{label}</span>
            {badge && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className="text-sm font-bold tabular-nums">{pct}%</span>
          {subValue && (
            <span className="block text-[11px] text-muted-foreground tabular-nums">
              {subValue}
            </span>
          )}
        </div>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/80">
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

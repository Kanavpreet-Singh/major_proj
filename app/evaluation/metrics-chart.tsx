import { cn } from '@/lib/utils';

const CONFIGS = [
  { name: 'Text only', f1: 76.2, acc: 74.5 },
  { name: 'Image only', f1: 72.4, acc: 70.8 },
  { name: 'Image + text', f1: 88.05, acc: 86.0, ours: true },
];

const MIN = 60; // bars start at 60% so differences are visible

/** Validation F1 and test accuracy for each input configuration. */
export function MetricsChart() {
  return (
    <div className="space-y-6">
      {CONFIGS.map((c) => (
        <div key={c.name} className="grid grid-cols-[7.5rem_1fr] items-center gap-4 sm:grid-cols-[9rem_1fr]">
          <span className={cn('text-sm', c.ours ? 'font-medium text-foreground' : 'text-muted-foreground')}>{c.name}</span>
          <div className="space-y-1.5">
            {[
              { v: c.f1, label: 'F1' },
              { v: c.acc, label: 'Accuracy' },
            ].map((m, i) => (
              <div key={m.label} className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', c.ours ? (i === 0 ? 'bg-primary' : 'bg-primary/50') : i === 0 ? 'bg-muted-foreground/50' : 'bg-muted-foreground/25')}
                    style={{ width: `${((m.v - MIN) / (100 - MIN)) * 100}%` }}
                  />
                </div>
                <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                  {m.label} {m.v.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

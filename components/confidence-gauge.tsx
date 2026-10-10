'use client';

import { cn } from '@/lib/utils';

interface ConfidenceGaugeProps {
  value: number;
  label?: string;
  sublabel?: string;
  size?: 'sm' | 'md' | 'lg';
  colorOverride?: string;
}

export function ConfidenceGauge({ value, label, sublabel, size = 'md', colorOverride }: ConfidenceGaugeProps) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const dims = {
    sm: { box: 80, stroke: 6, text: 'text-base' },
    md: { box: 120, stroke: 8, text: 'text-2xl' },
    lg: { box: 160, stroke: 10, text: 'text-3xl' },
  }[size];

  const radius = (dims.box - dims.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const color =
    colorOverride ||
    (pct >= 70 ? 'hsl(var(--success))' :
    pct >= 45 ? 'hsl(var(--warning))' :
    'hsl(var(--destructive))');

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: dims.box, height: dims.box }}>
        <svg width={dims.box} height={dims.box} className="-rotate-90">
          <circle
            cx={dims.box / 2}
            cy={dims.box / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={dims.stroke}
          />
          <circle
            cx={dims.box / 2}
            cy={dims.box / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={dims.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className={cn('absolute inset-0 flex items-center justify-center font-bold', dims.text)}>
          {pct}%
        </div>
      </div>
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
      {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
    </div>
  );
}

import { cn } from '@/lib/utils';
import type { Verdict } from '@/lib/types';

interface VerdictConfig {
  label: string;
  dot: string;
  color: string;
  mark: string;
}

const verdictMap: Record<Verdict, VerdictConfig> = {
  True: { label: 'True', dot: 'bg-success', color: 'text-success', mark: 'mark-true' },
  False: { label: 'False', dot: 'bg-destructive', color: 'text-destructive', mark: 'mark-false' },
  Misleading: { label: 'Misleading', dot: 'bg-warning', color: 'text-warning', mark: 'mark-unclear' },
  Unverifiable: { label: 'Unverifiable', dot: 'bg-muted-foreground', color: 'text-muted-foreground', mark: 'mark-pending' },
};

export function VerdictBadge({
  verdict,
  className,
  size = 'md',
}: {
  verdict: Verdict;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const config = verdictMap[verdict] ?? verdictMap.Unverifiable;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-medium',
        { sm: 'text-xs', md: 'text-sm', lg: 'text-base' }[size],
        className
      )}
    >
      <span className={cn('rounded-full', config.dot, size === 'lg' ? 'h-2.5 w-2.5' : 'h-2 w-2')} />
      {config.label}
    </span>
  );
}

export function verdictTitle(verdict: Verdict): string {
  return verdictMap[verdict]?.label || verdict;
}

export function verdictColor(verdict: Verdict): string {
  return verdictMap[verdict]?.color ?? 'text-muted-foreground';
}

export { verdictMap };

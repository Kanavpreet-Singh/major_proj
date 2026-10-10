import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import type { Verdict } from '@/lib/types';

interface VerdictConfig {
  label: string;
  sublabel: string;
  classes: string;
  icon: typeof CheckCircle2;
  color: string;
  bgColor: string;
  borderColor: string;
}

const verdictMap: Record<Verdict, VerdictConfig> = {
  True: {
    label: 'Real',
    sublabel: 'Authentic Content',
    classes: 'bg-success/15 text-success border-success/40 shadow-sm shadow-success/10',
    icon: CheckCircle2,
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
  },
  False: {
    label: 'Fake',
    sublabel: 'Misinformation Detected',
    classes: 'bg-destructive/15 text-destructive border-destructive/40 shadow-sm shadow-destructive/10',
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
  },
  Misleading: {
    label: 'Misleading',
    sublabel: 'Out of Context / Altered',
    classes: 'bg-warning/15 text-warning border-warning/40 shadow-sm shadow-warning/10',
    icon: AlertTriangle,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
  },
  Unverifiable: {
    label: 'Unverifiable',
    sublabel: 'Inconclusive Evidence',
    classes: 'bg-muted text-muted-foreground border-border',
    icon: HelpCircle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-border',
  },
};

export function VerdictBadge({
  verdict,
  className,
  size = 'md',
  showSublabel = false,
}: {
  verdict: Verdict;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSublabel?: boolean;
}) {
  const config = verdictMap[verdict];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'gap-1 px-2 py-0.5 text-xs',
    md: 'gap-1.5 px-3 py-1 text-sm',
    lg: 'gap-2 px-4 py-1.5 text-base font-bold',
  }[size];

  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }[size];

  return (
    <Badge
      variant="outline"
      className={cn('inline-flex items-center border font-semibold tracking-wide transition-all', sizeClasses, config.classes, className)}
    >
      <Icon className={iconSizes} />
      <span>{config.label}</span>
      {showSublabel && (
        <span className="ml-1 opacity-75 font-normal text-xs">({config.sublabel})</span>
      )}
    </Badge>
  );
}

export function verdictTitle(verdict: Verdict): string {
  return verdictMap[verdict]?.label || verdict;
}

export function verdictColor(verdict: Verdict): string {
  return verdictMap[verdict].color;
}

export { verdictMap };

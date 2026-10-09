import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import type { Verdict } from '@/lib/types';

interface VerdictConfig {
  label: string;
  classes: string;
  icon: typeof CheckCircle2;
  color: string;
  bgColor: string;
  borderColor: string;
}

const verdictMap: Record<Verdict, VerdictConfig> = {
  True: {
    label: 'True',
    classes: 'bg-success/10 text-success border-success/30',
    icon: CheckCircle2,
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
  },
  False: {
    label: 'False',
    classes: 'bg-destructive/10 text-destructive border-destructive/30',
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
  },
  Misleading: {
    label: 'Misleading',
    classes: 'bg-warning/10 text-warning border-warning/30',
    icon: AlertTriangle,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/30',
  },
  Unverifiable: {
    label: 'Unverifiable',
    classes: 'bg-muted text-muted-foreground border-border',
    icon: HelpCircle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-border',
  },
};

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  const config = verdictMap[verdict];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn('gap-1.5 border px-3 py-1 text-sm font-semibold', config.classes, className)}>
      <Icon className="h-4 w-4" />
      {config.label}
    </Badge>
  );
}

export function verdictColor(verdict: Verdict): string {
  return verdictMap[verdict].color;
}

export { verdictMap };

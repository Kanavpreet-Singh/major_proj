'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  DebateHeader,
  DebateTranscript,
  EvidenceList,
  JudgeDeliberating,
  JudgeRuling,
  ProbabilityBar,
  VERDICT_META,
  type Role,
  type SlotState,
} from '@/components/debate-panel';
import type { LiveDebate, LiveState, StageKey } from '@/lib/use-analysis-stream';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileText,
  Gavel,
  Globe,
  ListTree,
  Loader2,
  RotateCcw,
  Scale,
  Search,
  Terminal,
  Timer,
  XCircle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

const STAGES: { key: StageKey; label: string; icon: typeof Search }[] = [
  { key: 'extract', label: 'Read PDF', icon: FileText },
  { key: 'decompose', label: 'Break down', icon: ListTree },
  { key: 'queries', label: 'Plan searches', icon: Search },
  { key: 'evidence', label: 'Gather evidence', icon: Globe },
  { key: 'debate', label: 'Agent debate', icon: Gavel },
  { key: 'verdict', label: 'Verdict', icon: Scale },
];

const FINAL_META: Record<string, { title: string; cls: string; icon: typeof Check }> = {
  True: { title: 'TRUE', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 },
  False: { title: 'FALSE', cls: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400', icon: XCircle },
  Misleading: { title: 'MISLEADING', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400', icon: AlertTriangle },
  Unverifiable: { title: 'UNVERIFIABLE', cls: 'border-border bg-muted text-foreground', icon: HelpCircle },
};

const LOG_TONE: Record<string, string> = {
  info: 'text-muted-foreground',
  defender: 'text-emerald-600 dark:text-emerald-400',
  prosecutor: 'text-rose-600 dark:text-rose-400',
  judge: 'text-primary',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-destructive',
  success: 'text-foreground',
};

function useElapsed(startedAt: number, running: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);
  return Math.max(0, (running ? now : Date.now()) - startedAt);
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Stepper({ state }: { state: LiveState }) {
  const stages = STAGES.filter((s) => s.key !== 'extract' || state.input?.type === 'pdf');
  return (
    <div className="grid grid-cols-3 gap-y-4 sm:flex sm:items-start sm:justify-between">
      {stages.map((st, i) => {
        const status = state.stages[st.key];
        const failed = state.status === 'error' && status === 'active';
        const Icon = st.icon;
        return (
          <div key={st.key} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span
                className={cn(
                  'absolute right-1/2 top-5 hidden h-0.5 w-full -translate-y-1/2 sm:block',
                  status === 'pending' ? 'bg-border' : 'bg-primary/60'
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500',
                failed && 'border-destructive bg-destructive/10 text-destructive',
                !failed && status === 'pending' && 'border-border bg-background text-muted-foreground/60',
                !failed && status === 'active' && 'border-primary bg-primary/10 text-primary shadow-[0_0_0_6px] shadow-primary/10',
                !failed && status === 'done' && 'border-primary bg-primary text-primary-foreground'
              )}
            >
              {failed ? (
                <XCircle className="h-5 w-5" />
              ) : status === 'done' ? (
                <Check className="h-5 w-5" />
              ) : status === 'active' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </span>
            <span
              className={cn(
                'mt-2 text-[11px] font-semibold',
                status === 'pending' ? 'text-muted-foreground/70' : 'text-foreground'
              )}
            >
              {st.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LiveDebateView({
  d,
  index,
  total,
  fallback,
}: {
  d: LiveDebate;
  index: number;
  total: number;
  fallback?: LiveState['verdicts'][number];
}) {
  const evidence = Object.fromEntries(d.evidence.map((e) => [e.id, e]));
  const slot = (role: Role, round: number): SlotState => {
    const k = `${role}-${round}`;
    if (d.args.some((a) => a.role === role && a.round === round)) return 'shown';
    if (d.thinking.includes(k)) return 'thinking';
    if (d.failed.includes(k)) return 'failed';
    return 'hidden';
  };
  const label = d.label ?? fallback?.verdict;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {total > 1 ? `Subclaim ${index + 1} of ${total}` : 'Claim under debate'}
          </div>
          <p className="text-sm font-medium leading-snug">{d.subclaim}</p>
        </div>
        {label ? (
          <Badge variant="outline" className={cn('animate-in fade-in border text-xs font-semibold', VERDICT_META[label].cls)}>
            {VERDICT_META[label].label}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1.5 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
            </span>
            In session
          </Badge>
        )}
      </div>

      {d.evidence.length > 0 && <DebateHeader />}
      <DebateTranscript args={d.args} evidence={evidence} rounds={d.rounds} slot={slot} />

      {d.judging && <JudgeDeliberating />}
      {d.judge && d.grounding && (
        <JudgeRuling
          judge={d.judge}
          probs={{ supported: d.judge.p_supported, refuted: d.judge.p_refuted, insufficient: d.judge.p_insufficient }}
          grounding={d.grounding}
          abstained={!!d.abstained}
          hadDebate={d.args.length > 0}
        />
      )}
      {!d.judge && fallback && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="mb-2 font-semibold text-amber-700 dark:text-amber-400">
            Decided without a full debate ({fallback.method === 'single' ? 'single-model verdict' : 'keyword fallback'})
          </p>
          <ProbabilityBar probs={fallback.probs} />
        </div>
      )}
      <EvidenceList evidence={d.evidence} />
    </div>
  );
}

function ActivityLog({ state }: { state: LiveState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [state.log.length]);
  return (
    <Card className="rounded-2xl border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Terminal className="h-4 w-4 text-primary" />
          Agent activity log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={ref} className="max-h-80 space-y-1 overflow-y-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
          {state.log.map((l, i) => (
            <div key={i} className={cn('animate-in fade-in flex gap-2', LOG_TONE[l.tone])}>
              <span className="shrink-0 tabular-nums text-muted-foreground/60">{fmt(l.t - state.startedAt)}</span>
              <span className="min-w-0 break-words">{l.text}</span>
            </div>
          ))}
          {state.status === 'running' && <div className="animate-pulse text-muted-foreground">▍</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function SubclaimList({ state }: { state: LiveState }) {
  if (!state.subclaims.length) return null;
  return (
    <Card className="rounded-2xl border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ListTree className="h-4 w-4 text-primary" />
          Subclaims ({state.subclaims.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {state.subclaims.map((sc, i) => {
          const ev = state.evidence[i];
          const v = state.verdicts[i]?.verdict ?? state.debates[i]?.label;
          return (
            <div key={i} className="animate-in fade-in rounded-lg border border-border/60 p-2.5 text-xs">
              <p className="mb-1.5 leading-snug">{sc}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {ev ? (
                  <Badge variant="outline" className="text-[10px]">{ev.count} evidence</Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground">waiting for evidence…</span>
                )}
                {v && (
                  <Badge variant="outline" className={cn('border text-[10px]', VERDICT_META[v].cls)}>
                    {VERDICT_META[v].label}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function LiveAnalysis({ state, onReset, onCancel }: { state: LiveState; onReset: () => void; onCancel: () => void }) {
  const running = state.status === 'running';
  const elapsed = useElapsed(state.startedAt, running);
  const debateIdx = Object.keys(state.debates).map(Number).sort((a, b) => a - b);
  const final = state.done ? FINAL_META[state.done.label] ?? FINAL_META.Unverifiable : null;
  const FinalIcon = final?.icon;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* Header */}
        <Card className="overflow-hidden rounded-2xl border">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-r from-emerald-500/[0.07] via-primary/[0.07] to-rose-500/[0.07] px-5 py-3">
            <div className="flex items-center gap-2">
              {running ? (
                <Badge className="gap-1.5 bg-rose-600 text-white hover:bg-rose-600">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                  </span>
                  LIVE
                </Badge>
              ) : state.status === 'done' ? (
                <Badge variant="outline" className="gap-1 border-success/40 text-success">
                  <Check className="h-3 w-3" /> Complete
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                  <XCircle className="h-3 w-3" /> Stopped
                </Badge>
              )}
              <span className="text-sm font-semibold">Multi-agent verification</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
                <Timer className="h-4 w-4" />
                {fmt(state.done ? state.done.elapsedMs : elapsed)}
              </span>
              {running ? (
                <Button variant="outline" size="sm" className="h-8" onClick={onCancel}>
                  Cancel
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onReset}>
                  <RotateCcw className="h-3.5 w-3.5" /> New analysis
                </Button>
              )}
            </div>
          </div>
          <CardContent className="space-y-6 p-5">
            <blockquote className="border-l-2 border-primary/40 pl-3 text-base font-medium italic leading-snug">
              &ldquo;{state.pdf?.claim || state.input?.claim}&rdquo;
            </blockquote>
            <Stepper state={state} />
            {running && state.activity && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                <span className="truncate">{state.activity}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Problems */}
        {state.notices.map((n, i) => (
          <div
            key={i}
            className={cn(
              'flex items-start gap-2 rounded-xl border p-3 text-sm',
              n.level === 'error'
                ? 'border-destructive/40 bg-destructive/5 text-destructive'
                : 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400'
            )}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {n.message}
          </div>
        ))}
        {state.status === 'error' && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">The analysis could not finish</p>
              <p className="mt-1 break-words opacity-90">{state.error}</p>
            </div>
          </div>
        )}

        {/* Final verdict */}
        {state.done && final && FinalIcon && (
          <div className={cn('animate-in fade-in zoom-in-95 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 p-5 duration-500', final.cls)}>
            <div className="flex items-center gap-3">
              <FinalIcon className="h-10 w-10" />
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">Final verdict</div>
                <div className="text-3xl font-black tracking-tight">{final.title}</div>
                <div className="text-xs opacity-80">{Math.round(state.done.confidence * 100)}% confidence</div>
              </div>
            </div>
            <div className="flex min-w-[200px] flex-1 flex-col gap-3 sm:max-w-xs">
              {state.final && <ProbabilityBar probs={state.final.probs} />}
              <Button asChild className="gap-2">
                <Link href={`/analysis/${state.done.id}`}>
                  Open full report <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Debate arena */}
          <div className="space-y-6 lg:col-span-2">
            {debateIdx.length > 0 ? (
              <Card className="overflow-hidden rounded-2xl border">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Gavel className="h-4 w-4 text-primary" />
                    Debate arena
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 pt-6">
                  {debateIdx.map((i, n) => (
                    <div key={i} className={cn(n > 0 && 'border-t pt-6')}>
                      <LiveDebateView d={state.debates[i]} index={i} total={state.subclaims.length || debateIdx.length} fallback={state.verdicts[i]} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-2xl border border-dashed">
                <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                  <div className="flex items-center gap-4 text-muted-foreground/50">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600/60">
                      <Scale className="h-6 w-6" />
                    </span>
                    <Gavel className="h-6 w-6" />
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-600/60">
                      <Scale className="h-6 w-6" />
                    </span>
                  </div>
                  <p className="text-sm font-medium">
                    {state.status === 'error' ? 'The debate did not start.' : 'The debate starts once evidence is gathered.'}
                  </p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    A Defender and a Prosecutor will argue from the retrieved evidence, and a Judge will rule. You&apos;ll see every argument as it is written.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Side column */}
          <div className="space-y-6">
            <SubclaimList state={state} />
            <ActivityLog state={state} />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

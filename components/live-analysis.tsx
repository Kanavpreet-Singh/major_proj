'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  VerdictLabel,
  type Role,
  type SlotState,
} from '@/components/debate-panel';
import type { LiveDebate, LiveState, StageKey } from '@/lib/use-analysis-stream';

const STAGES: { key: StageKey; label: string }[] = [
  { key: 'extract', label: 'Reading PDF' },
  { key: 'decompose', label: 'Splitting claim' },
  { key: 'queries', label: 'Planning searches' },
  { key: 'evidence', label: 'Gathering evidence' },
  { key: 'debate', label: 'Debating' },
  { key: 'verdict', label: 'Verdict' },
];

const FINAL: Record<string, { word: string; color: string; mark: string }> = {
  True: { word: 'True', color: 'text-success', mark: 'mark-true' },
  False: { word: 'False', color: 'text-destructive', mark: 'mark-false' },
  Misleading: { word: 'Misleading', color: 'text-warning', mark: 'mark-unclear' },
  Unverifiable: { word: 'Unverifiable', color: 'text-muted-foreground', mark: 'mark-pending' },
};

const LOG_TONE: Record<string, string> = {
  defender: 'text-success',
  prosecutor: 'text-destructive',
  warn: 'text-warning',
  error: 'text-destructive',
};

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function useElapsed(startedAt: number, running: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);
  return Math.max(0, (running ? now : Date.now()) - startedAt);
}

function Steps({ state }: { state: LiveState }) {
  const stages = STAGES.filter((s) => s.key !== 'extract' || state.input?.type === 'pdf');
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {stages.map((st) => {
        const status = state.stages[st.key];
        const failed = state.status === 'error' && status === 'active';
        return (
          <li
            key={st.key}
            className={cn(
              'flex items-center gap-2 transition-colors',
              failed ? 'text-destructive' : status === 'pending' ? 'text-muted-foreground/60' : 'text-foreground'
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                failed ? 'bg-destructive' : status === 'done' ? 'bg-foreground' : status === 'active' ? 'animate-pulse bg-primary' : 'bg-muted-foreground/40'
              )}
            />
            {st.label}
          </li>
        );
      })}
    </ol>
  );
}

function LiveDebateView({ d, fallback, showClaim }: { d: LiveDebate; fallback?: LiveState['verdicts'][number]; showClaim: boolean }) {
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {showClaim ? <p className="max-w-[60ch] font-serif text-xl leading-snug">{d.subclaim}</p> : <span />}
        {label && <VerdictLabel verdict={label} className="animate-in fade-in" />}
      </div>
      {d.evidence.length > 0 && (
        <div className="hidden md:block">
          <DebateHeader />
        </div>
      )}
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
        <div className="space-y-3 border-t pt-5">
          <p className="text-sm text-warning">Decided without a debate</p>
          <ProbabilityBar probs={fallback.probs} />
        </div>
      )}
      <EvidenceList evidence={d.evidence} />
    </div>
  );
}

export function LiveAnalysis({ state, onReset, onCancel }: { state: LiveState; onReset: () => void; onCancel: () => void }) {
  const running = state.status === 'running';
  const elapsed = useElapsed(state.startedAt, running);
  const debateIdx = Object.keys(state.debates).map(Number).sort((a, b) => a - b);
  const final = state.done ? FINAL[state.done.label] ?? FINAL.Unverifiable : null;
  const claim = state.pdf?.claim || state.input?.claim;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto max-w-3xl space-y-10">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            {running ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                </span>
                Live
              </>
            ) : state.status === 'done' ? (
              'Done'
            ) : (
              'Stopped'
            )}
            <span className="tabular-nums">{fmt(state.done ? state.done.elapsedMs : elapsed)}</span>
          </span>
          {running ? (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onReset}>
              New check
            </Button>
          )}
        </div>

        <header className="space-y-6">
          <h1 className="font-serif text-3xl font-medium leading-snug tracking-tight sm:text-4xl">
            <span className={cn('transition-[background-image]', final ? final.mark : running ? 'mark-pending' : '')}>{claim}</span>
          </h1>
          {final && state.done ? (
            <div className="animate-in fade-in flex flex-wrap items-center gap-x-6 gap-y-3 duration-500">
              <span className={cn('font-serif text-3xl', final.color)}>{final.word}</span>
              <span className="text-sm text-muted-foreground">{Math.round(state.done.confidence * 100)}% confidence</span>
              <Button asChild size="sm" className="ml-auto">
                <Link href={`/analysis/${state.done.id}`}>Open report</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Steps state={state} />
              {running && state.activity && <p className="truncate text-sm text-muted-foreground">{state.activity}</p>}
            </div>
          )}
        </header>

        {state.notices.map((n, i) => (
          <p key={i} className={cn('border-l-2 pl-3 text-sm', n.level === 'error' ? 'border-destructive text-destructive' : 'border-warning text-warning')}>
            {n.message}
          </p>
        ))}
        {state.status === 'error' && <p className="border-l-2 border-destructive pl-3 text-sm text-destructive">{state.error}</p>}

        {debateIdx.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-serif text-2xl">Debate</h2>
            <div className="divide-y rounded-2xl border bg-card">
              {debateIdx.map((i) => (
                <div key={i} className="p-6 sm:p-8">
                  <LiveDebateView d={state.debates[i]} fallback={state.verdicts[i]} showClaim={(state.subclaims.length || debateIdx.length) > 1} />
                </div>
              ))}
            </div>
          </section>
        )}

        {state.log.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">Activity</summary>
            <ol className="mt-3 space-y-1">
              {state.log.map((l, i) => (
                <li key={i} className={cn('grid grid-cols-[3rem_1fr] gap-2', LOG_TONE[l.tone] ?? 'text-muted-foreground')}>
                  <span className="tabular-nums text-muted-foreground/70">{fmt(l.t - state.startedAt)}</span>
                  <span className="break-words">{l.text}</span>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </TooltipProvider>
  );
}

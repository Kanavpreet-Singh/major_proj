'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { DebateArgument, DebateCitation, DebateEvidence, LabelProbs, SubclaimDebate } from '@/lib/types';
import { Gavel, Shield, Swords, CheckCircle2, AlertTriangle, Play, ExternalLink, Flag, XCircle } from 'lucide-react';

export type Role = 'defender' | 'prosecutor';
export type SlotState = 'shown' | 'thinking' | 'failed' | 'hidden';

export const VERDICT_META: Record<SubclaimDebate['verdict'], { label: string; cls: string }> = {
  supported: { label: 'Supported', cls: 'bg-success/15 text-success border-success/30' },
  not_supported: { label: 'Refuted', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  insufficient: { label: 'Insufficient evidence', cls: 'bg-muted text-muted-foreground border-border' },
};

export const ROLE_META = {
  defender: {
    name: 'Defender',
    stance: 'Argues the claim is true',
    icon: Shield,
    box: 'border-emerald-500/30 bg-emerald-500/[0.06]',
    title: 'text-emerald-700 dark:text-emerald-400',
    avatar: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  prosecutor: {
    name: 'Prosecutor',
    stance: 'Argues the claim is false',
    icon: Swords,
    box: 'border-rose-500/30 bg-rose-500/[0.06]',
    title: 'text-rose-700 dark:text-rose-400',
    avatar: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-rose-500/30',
    dot: 'bg-rose-500',
  },
} as const;

const ROLES: Role[] = ['defender', 'prosecutor'];

function pct(x: number | null | undefined) {
  return x == null ? '–' : `${Math.round(x * 100)}%`;
}

export function ProbabilityBar({ probs, className }: { probs: LabelProbs; className?: string }) {
  const segs = [
    { key: 'supported', label: 'Supported', v: probs.supported, cls: 'bg-success' },
    { key: 'refuted', label: 'Refuted', v: probs.refuted, cls: 'bg-destructive' },
    { key: 'insufficient', label: 'Insufficient', v: probs.insufficient, cls: 'bg-muted-foreground/40' },
  ];
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {segs.map((s) =>
          s.v > 0 ? <div key={s.key} className={cn('h-full transition-all duration-700', s.cls)} style={{ width: `${s.v * 100}%` }} /> : null
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
        {segs.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', s.cls)} />
            {s.label} {pct(s.v)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Defender vs Prosecutor, with the Judge between them. */
export function DebateHeader() {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2.5">
      {ROLES.map((role, i) => {
        const m = ROLE_META[role];
        const Icon = m.icon;
        const side = (
          <div key={role} className={cn('flex items-center gap-2', i === 1 && 'flex-row-reverse text-right')}>
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1', m.avatar)}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className={cn('text-xs font-bold uppercase tracking-wide', m.title)}>{m.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">{m.stance}</div>
            </div>
          </div>
        );
        return i === 0
          ? [
              side,
              <div key="judge" className="flex flex-col items-center px-1 text-primary">
                <Gavel className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Judge</span>
              </div>,
            ]
          : side;
      })}
    </div>
  );
}

function CitationChip({ c, evidence }: { c: DebateCitation; evidence?: DebateEvidence }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex cursor-help items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold',
            c.verified
              ? 'border-success/40 bg-success/10 text-success'
              : 'border-destructive/40 bg-destructive/10 text-destructive line-through decoration-1'
          )}
        >
          {c.verified ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {c.id}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs space-y-1 text-xs">
        <p className="font-semibold">
          {c.verified ? 'Quote verified in the evidence' : 'Quote NOT found in the evidence. The judge ignores it.'}
        </p>
        <p className="italic">&ldquo;{c.quote}&rdquo;</p>
        {evidence && <p className="text-muted-foreground">Source: {evidence.source_name}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export function ArgumentBubble({ a, evidence }: { a: DebateArgument; evidence: Record<string, DebateEvidence> }) {
  const meta = ROLE_META[a.role];
  const Icon = meta.icon;
  const verified = a.citations.filter((c) => c.verified).length;
  return (
    <div className={cn('animate-in fade-in slide-in-from-bottom-3 rounded-xl border p-3.5 duration-500', meta.box)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={cn('flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide', meta.title)}>
          <Icon className="h-3.5 w-3.5" />
          {meta.name}
        </span>
        <div className="flex items-center gap-1.5">
          {a.citations.length > 0 && (
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {verified}/{a.citations.length} quotes verified
            </span>
          )}
          {a.conceded && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Flag className="h-3 w-3" /> Concedes
            </Badge>
          )}
        </div>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{a.argument || <em className="text-muted-foreground">No argument.</em>}</p>
      {a.citations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {a.citations.map((c, i) => (
            <CitationChip key={i} c={c} evidence={evidence[c.id]} />
          ))}
        </div>
      )}
    </div>
  );
}

function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {[0, 150, 300].map((d) => (
        <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

function PlaceholderBubble({ role, state }: { role: Role; state: 'thinking' | 'failed' }) {
  const m = ROLE_META[role];
  return (
    <div className={cn('rounded-xl border border-dashed p-3.5', m.box)}>
      <span className={cn('flex items-center gap-2 text-xs font-bold uppercase tracking-wide', m.title)}>
        {state === 'thinking' ? (
          <>
            {m.name} is building an argument <TypingDots />
          </>
        ) : (
          <>
            <XCircle className="h-3.5 w-3.5" /> {m.name} could not respond
          </>
        )}
      </span>
    </div>
  );
}

/**
 * The rounds of a debate. `slot(role, round)` decides what each position shows,
 * so the same component renders a live debate, a replay and a finished one.
 */
export function DebateTranscript({
  args,
  evidence,
  rounds,
  slot,
}: {
  args: DebateArgument[];
  evidence: Record<string, DebateEvidence>;
  rounds: number;
  slot: (role: Role, round: number) => SlotState;
}) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => {
        const states = ROLES.map((role) => slot(role, r));
        if (states.every((s) => s === 'hidden')) return null;
        return (
          <div key={r} className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {r === 1 ? 'Round 1 · Opening arguments' : `Round ${r} · Rebuttal`}
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {ROLES.map((role, i) => {
                const state = states[i];
                const a = args.find((x) => x.round === r && x.role === role);
                if (state === 'shown' && a) return <ArgumentBubble key={role} a={a} evidence={evidence} />;
                if (state === 'thinking' || state === 'failed') return <PlaceholderBubble key={role} role={role} state={state} />;
                return <div key={role} className="hidden md:block" />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function JudgeDeliberating() {
  return (
    <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4">
      <Gavel className="h-5 w-5 animate-pulse text-primary" />
      <span className="text-sm font-semibold text-primary">
        The Judge is weighing both sides against the evidence <TypingDots className="ml-1" />
      </span>
    </div>
  );
}

export function JudgeRuling({
  judge,
  probs,
  grounding,
  abstained,
  hadDebate,
}: {
  judge: SubclaimDebate['judge'];
  probs: LabelProbs;
  grounding: SubclaimDebate['grounding'];
  abstained: boolean;
  hadDebate: boolean;
}) {
  return (
    <div className="animate-in fade-in zoom-in-95 rounded-xl border-2 border-primary/25 bg-primary/5 p-4 duration-500">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
          <Gavel className="h-4 w-4" />
          Judge&apos;s ruling
          {judge.winner !== 'tie' && hadDebate && (
            <span className="font-medium normal-case text-muted-foreground">
              · {ROLE_META[judge.winner].name} made the stronger case
            </span>
          )}
        </span>
        {abstained && (
          <Badge variant="outline" className="text-[10px]">
            Abstained, not confident enough
          </Badge>
        )}
      </div>
      {judge.reasoning && <p className="mb-3 text-sm leading-relaxed">{judge.reasoning}</p>}
      <ProbabilityBar probs={probs} />
      {hadDebate && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>Defender quotes verified: <b className="tabular-nums">{pct(grounding.defender)}</b></span>
          <span>Prosecutor quotes verified: <b className="tabular-nums">{pct(grounding.prosecutor)}</b></span>
          {judge.decisive_evidence.length > 0 && <span>Decisive evidence: <b>{judge.decisive_evidence.join(', ')}</b></span>}
        </div>
      )}
    </div>
  );
}

export function EvidenceList({ evidence }: { evidence: DebateEvidence[] }) {
  if (!evidence.length) return null;
  return (
    <details className="group rounded-xl border border-border/60">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
        Evidence the agents were allowed to cite ({evidence.length})
      </summary>
      <div className="space-y-2 px-4 pb-4">
        {evidence.map((e) => (
          <div key={e.id} className="rounded-lg bg-muted/40 p-3 text-xs">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded bg-background px-1.5 py-0.5 font-mono font-bold">{e.id}</span>
              <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1 truncate font-semibold hover:underline">
                {e.source_name}
                <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
              </a>
            </div>
            <p className="leading-relaxed text-muted-foreground">{e.passage}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

/** Order in which arguments are revealed: round by round, Defender first. */
function revealOrder(args: DebateArgument[]) {
  return [...args].sort((a, b) => a.round - b.round || (a.role === 'defender' ? -1 : 1));
}

function SubclaimDebateView({ d, index, total }: { d: SubclaimDebate; index: number; total: number }) {
  const evidence = Object.fromEntries(d.evidence.map((e) => [e.id, e]));
  const order = revealOrder(d.arguments);
  const rounds = Math.max(0, ...d.arguments.map((a) => a.round));
  // Replay: step k shows the first k arguments; the next one is "thinking"
  const steps = order.length + 1;
  const [shown, setShown] = useState(steps);
  const replaying = shown < steps;

  useEffect(() => {
    if (!replaying) return;
    const t = setTimeout(() => setShown((s) => s + 1), 1600);
    return () => clearTimeout(t);
  }, [shown, replaying]);

  const slot = (role: Role, round: number): SlotState => {
    const k = order.findIndex((a) => a.role === role && a.round === round);
    if (k === -1) return 'hidden';
    return k < shown ? 'shown' : k === shown ? 'thinking' : 'hidden';
  };
  const v = VERDICT_META[d.verdict];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {total > 1 ? `Subclaim ${index + 1} of ${total}` : 'Claim under debate'}
          </div>
          <p className="text-sm font-medium leading-snug">{d.subclaim}</p>
        </div>
        <div className="flex items-center gap-2">
          {d.arguments.length > 0 && (
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setShown(0)} disabled={replaying}>
              <Play className="h-3 w-3" />
              {replaying ? 'Replaying…' : 'Replay debate'}
            </Button>
          )}
          <Badge variant="outline" className={cn('border text-xs font-semibold', v.cls)}>
            {v.label}
          </Badge>
        </div>
      </div>

      {d.arguments.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
          No debate was held: no evidence was retrieved for this subclaim, so the system abstained.
        </p>
      ) : (
        <>
          <DebateHeader />
          <DebateTranscript args={d.arguments} evidence={evidence} rounds={rounds} slot={slot} />
        </>
      )}

      {replaying ? (
        shown === order.length && <JudgeDeliberating />
      ) : (
        <JudgeRuling judge={d.judge} probs={d.probs} grounding={d.grounding} abstained={d.abstained} hadDebate={d.arguments.length > 0} />
      )}

      <EvidenceList evidence={d.evidence} />
    </div>
  );
}

export function DebatePanel({ debate, labelProbs }: { debate: SubclaimDebate[]; labelProbs?: LabelProbs }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Card className="overflow-hidden rounded-2xl border">
        <CardHeader className="space-y-3 border-b bg-gradient-to-r from-emerald-500/[0.06] via-primary/[0.06] to-rose-500/[0.06] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Gavel className="h-4 w-4 text-primary" />
              Multi-Agent Debate
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Every quote is automatically checked against the retrieved evidence
            </span>
          </div>
          {labelProbs && debate.length > 1 && (
            <div className="rounded-xl bg-background/60 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Whole claim (combined from all subclaims)
              </div>
              <ProbabilityBar probs={labelProbs} />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
          {debate.map((d, i) => (
            <div key={i} className={cn(i > 0 && 'border-t pt-6')}>
              <SubclaimDebateView d={d} index={i} total={debate.length} />
            </div>
          ))}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

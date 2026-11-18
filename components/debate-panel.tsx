'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { DebateArgument, DebateCitation, DebateEvidence, LabelProbs, SubclaimDebate } from '@/lib/types';
import { Gavel, Play } from 'lucide-react';

export type Role = 'defender' | 'prosecutor';
export type SlotState = 'shown' | 'thinking' | 'failed' | 'hidden';

export const VERDICT_META: Record<SubclaimDebate['verdict'], { label: string; cls: string; dot: string }> = {
  supported: { label: 'Holds up', cls: 'text-success', dot: 'bg-success' },
  not_supported: { label: 'False', cls: 'text-destructive', dot: 'bg-destructive' },
  insufficient: { label: 'Not enough evidence', cls: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

export const ROLE_META = {
  defender: { name: 'Defender', rule: 'border-success', text: 'text-success' },
  prosecutor: { name: 'Prosecutor', rule: 'border-destructive', text: 'text-destructive' },
} as const;

const ROLES: Role[] = ['defender', 'prosecutor'];

const pct = (x: number | null | undefined) => (x == null ? 'n/a' : `${Math.round(x * 100)}%`);

export function VerdictLabel({ verdict, className }: { verdict: SubclaimDebate['verdict']; className?: string }) {
  const v = VERDICT_META[verdict];
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm font-medium', v.cls, className)}>
      <span className={cn('h-2 w-2 rounded-full', v.dot)} />
      {v.label}
    </span>
  );
}

export function ProbabilityBar({ probs, className }: { probs: LabelProbs; className?: string }) {
  const segs = [
    { label: 'Holds up', v: probs.supported, cls: 'bg-success' },
    { label: 'False', v: probs.refuted, cls: 'bg-destructive' },
    { label: 'Not enough evidence', v: probs.insufficient, cls: 'bg-muted-foreground/40' },
  ];
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
        {segs.map((s) =>
          s.v > 0 ? <div key={s.label} className={cn('h-full transition-all duration-700', s.cls)} style={{ width: `${s.v * 100}%` }} /> : null
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs tabular-nums text-muted-foreground">
        {segs.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full', s.cls)} />
            {s.label} {pct(s.v)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Column headings: who argues on each side. */
export function DebateHeader() {
  return (
    <div className="grid grid-cols-2 gap-6 text-sm font-medium">
      <span className="text-success">Defender</span>
      <span className="text-destructive md:text-left">Prosecutor</span>
    </div>
  );
}

function CitationChip({ c, evidence }: { c: DebateCitation; evidence?: DebateEvidence }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'rounded px-1 font-mono text-[11px] tabular-nums',
            c.verified ? 'bg-muted text-foreground' : 'text-destructive line-through decoration-destructive/70'
          )}
          aria-label={`${c.id}, ${c.verified ? 'verified quote' : 'quote not found in evidence'}`}
        >
          {c.id}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs space-y-1.5 text-xs">
        <p className="font-medium">{c.verified ? 'Found in the source' : 'Not found in any source'}</p>
        <p className="font-serif text-sm italic">&ldquo;{c.quote}&rdquo;</p>
        {evidence && <p className="text-muted-foreground">{evidence.source_name}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export function ArgumentBubble({ a, evidence, stacked = false }: { a: DebateArgument; evidence: Record<string, DebateEvidence>; stacked?: boolean }) {
  const meta = ROLE_META[a.role];
  return (
    <div className={cn('animate-in fade-in border-l-2 pl-4 duration-500', meta.rule)}>
      <span className={cn('mb-1 block text-xs font-medium', !stacked && 'md:hidden', meta.text)}>{meta.name}</span>
      <p className="leading-relaxed text-foreground/90">
        {a.argument || <em className="text-muted-foreground">No argument.</em>}
        {a.conceded && <span className="ml-2 text-sm text-muted-foreground">(concedes)</span>}
      </p>
      {a.citations.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {a.citations.map((c, i) => (
            <CitationChip key={i} c={c} evidence={evidence[c.id]} />
          ))}
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="writing">
      {[0, 150, 300].map((d) => (
        <span key={d} className="h-1 w-1 animate-bounce rounded-full bg-current" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

function Placeholder({ role, state, stacked }: { role: Role; state: 'thinking' | 'failed'; stacked: boolean }) {
  const m = ROLE_META[role];
  return (
    <div className={cn('border-l-2 border-dashed pl-4 text-sm', m.rule, m.text)}>
      <span className={cn('mb-1 block text-xs font-medium', !stacked && 'md:hidden')}>{m.name}</span>
      {state === 'thinking' ? <TypingDots /> : <span className="text-muted-foreground">No response</span>}
    </div>
  );
}

/**
 * The rounds of a debate. `slot(role, round)` decides what each position shows,
 * so one component renders a live debate, a replay and a finished one.
 */
export function DebateTranscript({
  args,
  evidence,
  rounds,
  slot,
  stacked = false,
}: {
  args: DebateArgument[];
  evidence: Record<string, DebateEvidence>;
  rounds: number;
  slot: (role: Role, round: number) => SlotState;
  /** One column, for narrow containers */
  stacked?: boolean;
}) {
  return (
    <div className="space-y-6">
      {Array.from({ length: rounds }, (_, i) => i + 1).map((r) => {
        const states = ROLES.map((role) => slot(role, r));
        if (states.every((s) => s === 'hidden')) return null;
        return (
          <div key={r} className="space-y-3">
            {rounds > 1 && <p className="text-xs text-muted-foreground">{r === 1 ? 'Opening' : 'Rebuttal'}</p>}
            <div className={cn('grid gap-5', !stacked && 'md:grid-cols-2 md:gap-6')}>
              {ROLES.map((role, i) => {
                const state = states[i];
                const a = args.find((x) => x.round === r && x.role === role);
                if (state === 'shown' && a) return <ArgumentBubble key={role} a={a} evidence={evidence} stacked={stacked} />;
                if (state === 'thinking' || state === 'failed') return <Placeholder key={role} role={role} state={state} stacked={stacked} />;
                return stacked ? null : <div key={role} className="hidden md:block" />;
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
    <div className="flex items-center gap-3 border-t pt-5 text-sm text-muted-foreground">
      <Gavel className="h-4 w-4 animate-pulse" />
      Judge is deciding <TypingDots />
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
    <div className="animate-in fade-in space-y-4 border-t pt-5 duration-500">
      <div className="flex items-start gap-3">
        <Gavel className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Judge" />
        <p className="font-serif text-lg leading-relaxed">{judge.reasoning || (abstained ? 'Not enough evidence to decide.' : '')}</p>
      </div>
      <ProbabilityBar probs={probs} className="pl-7" />
      {hadDebate && (grounding.defender != null || grounding.prosecutor != null) && (
        <p className="pl-7 text-xs text-muted-foreground">
          Quotes found in sources: defender {pct(grounding.defender)}, prosecutor {pct(grounding.prosecutor)}
        </p>
      )}
    </div>
  );
}

export function EvidenceList({ evidence }: { evidence: DebateEvidence[] }) {
  if (!evidence.length) return null;
  return (
    <details className="group text-sm">
      <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
        Evidence ({evidence.length})
      </summary>
      <ol className="mt-3 space-y-3">
        {evidence.map((e) => (
          <li key={e.id} className="grid grid-cols-[2.25rem_1fr] gap-2">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{e.id}</span>
            <div className="space-y-1">
              <p className="leading-relaxed text-foreground/80">{e.passage}</p>
              <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline">
                {e.source_name}
              </a>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

/** Order arguments are revealed in: round by round, Defender first. */
function revealOrder(args: DebateArgument[]) {
  return [...args].sort((a, b) => a.round - b.round || (a.role === 'defender' ? -1 : 1));
}

function SubclaimDebateView({ d, showClaim }: { d: SubclaimDebate; showClaim: boolean }) {
  const evidence = Object.fromEntries(d.evidence.map((e) => [e.id, e]));
  const order = revealOrder(d.arguments);
  const rounds = Math.max(0, ...d.arguments.map((a) => a.round));
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {showClaim ? <p className="max-w-[60ch] font-serif text-xl leading-snug">{d.subclaim}</p> : <span />}
        <div className="flex items-center gap-4">
          <VerdictLabel verdict={d.verdict} />
          {d.arguments.length > 0 && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={() => setShown(0)} disabled={replaying}>
              <Play className="h-3.5 w-3.5" />
              Replay
            </Button>
          )}
        </div>
      </div>

      {d.arguments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No evidence was found, so there was no debate.</p>
      ) : (
        <>
          <div className="hidden md:block">
            <DebateHeader />
          </div>
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
      <section className="space-y-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-serif text-2xl">Debate</h2>
          {labelProbs && debate.length > 1 && <ProbabilityBar probs={labelProbs} className="w-full max-w-sm" />}
        </div>
        <div className="divide-y rounded-2xl border bg-card">
          {debate.map((d, i) => (
            <div key={i} className="p-6 sm:p-8">
              <SubclaimDebateView d={d} showClaim={debate.length > 1} />
            </div>
          ))}
        </div>
      </section>
    </TooltipProvider>
  );
}

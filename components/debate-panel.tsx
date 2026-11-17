'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { DebateArgument, DebateCitation, DebateEvidence, LabelProbs, SubclaimDebate } from '@/lib/types';
import { Gavel, Shield, Swords, CheckCircle2, AlertTriangle, Play, ExternalLink, Flag } from 'lucide-react';

const VERDICT_META: Record<SubclaimDebate['verdict'], { label: string; cls: string }> = {
  supported: { label: 'Supported', cls: 'bg-success/15 text-success border-success/30' },
  not_supported: { label: 'Refuted', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  insufficient: { label: 'Insufficient evidence', cls: 'bg-muted text-muted-foreground border-border' },
};

const ROLE_META = {
  defender: {
    name: 'Defender',
    stance: 'argues the claim is true',
    icon: Shield,
    box: 'border-emerald-500/30 bg-emerald-500/5',
    title: 'text-emerald-700 dark:text-emerald-400',
  },
  prosecutor: {
    name: 'Prosecutor',
    stance: 'argues the claim is false',
    icon: Swords,
    box: 'border-rose-500/30 bg-rose-500/5',
    title: 'text-rose-700 dark:text-rose-400',
  },
} as const;

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
          {c.verified ? 'Quote verified in evidence' : 'Quote NOT found in evidence. The judge ignores it.'}
        </p>
        <p className="italic">&ldquo;{c.quote}&rdquo;</p>
        {evidence && <p className="text-muted-foreground">Source: {evidence.source_name}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function ArgumentBubble({ a, evidence }: { a: DebateArgument; evidence: Record<string, DebateEvidence> }) {
  const meta = ROLE_META[a.role];
  const Icon = meta.icon;
  return (
    <div className={cn('animate-in fade-in slide-in-from-bottom-2 rounded-xl border p-3.5 duration-500', meta.box)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={cn('flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide', meta.title)}>
          <Icon className="h-3.5 w-3.5" />
          {meta.name}
        </span>
        {a.conceded && (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Flag className="h-3 w-3" /> Concedes
          </Badge>
        )}
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

function SubclaimDebateView({ d, index, total }: { d: SubclaimDebate; index: number; total: number }) {
  const evidence = Object.fromEntries(d.evidence.map((e) => [e.id, e]));
  const rounds = Array.from(new Set(d.arguments.map((a) => a.round))).sort((x, y) => x - y);
  // Replay: reveal arguments one at a time, then the judge
  const steps = d.arguments.length + 1;
  const [shown, setShown] = useState(steps);
  const replaying = shown < steps;

  useEffect(() => {
    if (!replaying) return;
    const t = setTimeout(() => setShown((s) => s + 1), 1400);
    return () => clearTimeout(t);
  }, [shown, replaying]);

  const order = rounds.flatMap((r) =>
    (['defender', 'prosecutor'] as const).map((role) => d.arguments.find((a) => a.round === r && a.role === role))
  );
  const visible = new Set(order.filter(Boolean).slice(0, shown));
  const v = VERDICT_META[d.verdict];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {total > 1 && (
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Subclaim {index + 1} of {total}
            </div>
          )}
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
        rounds.map((r) => (
          <div key={r} className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {r === 1 ? 'Opening arguments' : `Rebuttal ${r - 1}`}
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(['defender', 'prosecutor'] as const).map((role) => {
                const a = d.arguments.find((x) => x.round === r && x.role === role);
                if (!a) return <div key={role} className="hidden md:block" />;
                return visible.has(a) ? (
                  <ArgumentBubble key={role} a={a} evidence={evidence} />
                ) : (
                  <div key={role} className={cn('rounded-xl border border-dashed p-3.5', ROLE_META[role].box)}>
                    <span className={cn('text-xs font-bold uppercase tracking-wide opacity-60', ROLE_META[role].title)}>
                      {ROLE_META[role].name} is thinking…
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {!replaying && (
        <div className="animate-in fade-in rounded-xl border-2 border-primary/25 bg-primary/5 p-4 duration-500">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
              <Gavel className="h-4 w-4" />
              Judge&apos;s ruling
              {d.judge.winner !== 'tie' && d.arguments.length > 0 && (
                <span className="font-medium normal-case text-muted-foreground">
                  · {ROLE_META[d.judge.winner].name} made the stronger case
                </span>
              )}
            </span>
            {d.abstained && (
              <Badge variant="outline" className="text-[10px]">
                Abstained, not confident enough
              </Badge>
            )}
          </div>
          {d.judge.reasoning && <p className="mb-3 text-sm leading-relaxed">{d.judge.reasoning}</p>}
          <ProbabilityBar probs={d.probs} />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>Defender quotes verified: <b className="tabular-nums">{pct(d.grounding.defender)}</b></span>
            <span>Prosecutor quotes verified: <b className="tabular-nums">{pct(d.grounding.prosecutor)}</b></span>
            {d.judge.decisive_evidence.length > 0 && <span>Decisive evidence: <b>{d.judge.decisive_evidence.join(', ')}</b></span>}
          </div>
        </div>
      )}

      {d.evidence.length > 0 && (
        <details className="group rounded-xl border border-border/60">
          <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
            Evidence the agents were allowed to cite ({d.evidence.length})
          </summary>
          <div className="space-y-2 px-4 pb-4">
            {d.evidence.map((e) => (
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
      )}
    </div>
  );
}

export function DebatePanel({ debate, labelProbs }: { debate: SubclaimDebate[]; labelProbs?: LabelProbs }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Card className="rounded-2xl border">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Gavel className="h-4 w-4 text-primary" />
              Agent Debate
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Prosecutor vs Defender · every quote checked against the evidence
            </span>
          </div>
          {labelProbs && debate.length > 1 && (
            <div className="rounded-xl bg-muted/30 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Whole claim (combined from all subclaims)
              </div>
              <ProbabilityBar probs={labelProbs} />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-8">
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

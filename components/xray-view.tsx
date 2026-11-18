'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { faviconUrl } from '@/lib/format';
import {
  DebateTranscript,
  EvidenceList,
  JudgeDeliberating,
  JudgeRuling,
  ProbabilityBar,
  VerdictLabel,
  type Role,
  type SlotState,
} from '@/components/debate-panel';
import type { LiveDebate } from '@/lib/use-analysis-stream';
import type { ClaimStatus, LiveClaim, XRayStage } from '@/lib/use-xray-stream';
import type { SubclaimDebate } from '@/lib/types';
import type { XRaySummary } from '@/lib/validations';

type Label = 'supported' | 'not_supported' | 'insufficient';

const MARK: Record<Label, string> = {
  supported: 'mark-true',
  not_supported: 'mark-false',
  insufficient: 'mark-unclear',
};

const NUMBER_COLOR: Record<Label, string> = {
  supported: 'bg-success text-success-foreground',
  not_supported: 'bg-destructive text-destructive-foreground',
  insufficient: 'bg-warning text-warning-foreground',
};

const STATUS_TEXT: Record<Exclude<ClaimStatus, 'done'>, string> = {
  queued: 'Waiting',
  searching: 'Searching',
  debating: 'Debating',
};

function toLive(d: SubclaimDebate): LiveDebate {
  return {
    subclaim: d.subclaim,
    evidence: d.evidence,
    rounds: Math.max(0, ...d.arguments.map((a) => a.round)),
    args: d.arguments,
    thinking: [],
    failed: [],
    judging: false,
    judge: d.judge,
    label: d.verdict,
    abstained: d.abstained,
    grounding: d.grounding,
  };
}

const done = (c: LiveClaim) => c.status === 'done' && c.label;
const markClass = (c: LiveClaim) => (done(c) ? MARK[c.label as Label] : 'mark-pending');
const numberClass = (c: LiveClaim) =>
  done(c) ? NUMBER_COLOR[c.label as Label] : c.status === 'queued' ? 'bg-muted text-muted-foreground' : 'animate-pulse bg-primary text-primary-foreground';

function Score({ claims, summary, running }: { claims: LiveClaim[]; summary?: XRaySummary; running: boolean }) {
  const n = (l: Label) => claims.filter((c) => c.status === 'done' && c.label === l).length;
  const sup = n('supported');
  const ref = n('not_supported');
  const ins = n('insufficient');
  const pending = claims.length - sup - ref - ins;
  const decided = sup + ref;
  const score = summary?.truth_score ?? (decided ? sup / decided : null);
  const total = Math.max(1, claims.length);
  const segs = [
    { n: sup, cls: 'bg-success', label: 'hold up' },
    { n: ref, cls: 'bg-destructive', label: 'false' },
    { n: ins, cls: 'bg-warning', label: 'unclear' },
    { n: pending, cls: 'animate-pulse bg-muted-foreground/30', label: 'checking' },
  ];

  return (
    <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
      <div>
        <div className="font-serif text-6xl tabular-nums leading-none">{score == null ? '–' : `${Math.round(score * 100)}%`}</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {claims.length === 0 ? (running ? 'Finding claims' : 'No claims found') : 'of checked claims hold up'}
        </div>
      </div>
      {claims.length > 0 && (
        <div className="min-w-[220px] flex-1 space-y-2 pb-1">
          <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
            {segs.map((s, i) =>
              s.n > 0 ? <div key={i} className={cn('h-full transition-all duration-700', s.cls)} style={{ width: `${(s.n / total) * 100}%` }} /> : null
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs tabular-nums text-muted-foreground">
            {segs.map((s, i) =>
              s.n > 0 ? (
                <span key={i} className="inline-flex items-center gap-1.5">
                  <span className={cn('h-1.5 w-1.5 rounded-full', s.cls)} />
                  {s.n} {s.label}
                </span>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HighlightedArticle({
  text,
  claims,
  selected,
  onSelect,
}: {
  text: string;
  claims: LiveClaim[];
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  const paragraphs = useMemo(() => {
    const out: { start: number; end: number }[] = [];
    let pos = 0;
    for (const p of text.split('\n\n')) {
      out.push({ start: pos, end: pos + p.length });
      pos += p.length + 2;
    }
    return out;
  }, [text]);
  const sorted = useMemo(() => [...claims].sort((a, b) => a.start - b.start), [claims]);

  return (
    <div className="max-w-[68ch] space-y-5 font-serif text-[1.15rem] leading-[1.8] text-foreground/90">
      {paragraphs.map((p, pi) => {
        const nodes: ReactNode[] = [];
        let cursor = p.start;
        for (const c of sorted) {
          if (c.end <= p.start || c.start >= p.end) continue;
          const s = Math.max(c.start, p.start);
          const e = Math.min(c.end, p.end);
          if (s > cursor) nodes.push(text.slice(cursor, s));
          nodes.push(
            <span
              key={`${c.index}-${s}`}
              role="button"
              tabIndex={0}
              aria-pressed={selected === c.index}
              onClick={() => onSelect(c.index)}
              onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onSelect(c.index))}
              className={cn(
                'cursor-pointer rounded-sm text-foreground transition-[outline]',
                markClass(c),
                c.status !== 'done' && c.status !== 'queued' && 'animate-pulse',
                selected === c.index && 'underline decoration-foreground/60 decoration-1 underline-offset-[6px]'
              )}
            >
              {text.slice(s, e)}
              {e === c.end && (
                <sup className={cn('ml-1 inline-flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full px-1 font-sans text-[10px] font-semibold', numberClass(c))}>
                  {c.index + 1}
                </sup>
              )}
            </span>
          );
          cursor = e;
        }
        if (cursor < p.end) nodes.push(text.slice(cursor, p.end));
        return <p key={pi}>{nodes}</p>;
      })}
    </div>
  );
}

function ClaimInspector({ claim }: { claim: LiveClaim }) {
  const debate: LiveDebate | undefined = claim.live ?? (claim.debate ? toLive(claim.debate as SubclaimDebate) : undefined);
  const evidence = Object.fromEntries((debate?.evidence ?? []).map((e) => [e.id, e]));
  const slot = (role: Role, round: number): SlotState => {
    if (!debate) return 'hidden';
    const k = `${role}-${round}`;
    if (debate.args.some((a) => a.role === role && a.round === round)) return 'shown';
    if (debate.thinking.includes(k)) return 'thinking';
    if (debate.failed.includes(k)) return 'failed';
    return 'hidden';
  };
  const label = done(claim) ? (claim.label as Label) : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold', numberClass(claim))}>{claim.index + 1}</span>
          {label ? (
            <VerdictLabel verdict={label} />
          ) : (
            <span className="text-sm text-muted-foreground">{claim.activity || STATUS_TEXT[claim.status as Exclude<ClaimStatus, 'done'>]}</span>
          )}
        </div>
        <p className="font-serif text-xl leading-snug">{claim.claim}</p>
      </div>

      {debate && (debate.args.length > 0 || debate.thinking.length > 0) && (
        <DebateTranscript args={debate.args} evidence={evidence} rounds={debate.rounds} slot={slot} stacked />
      )}
      {debate?.judging && <JudgeDeliberating />}
      {debate?.judge && debate.grounding ? (
        <JudgeRuling
          judge={debate.judge}
          probs={{ supported: debate.judge.p_supported, refuted: debate.judge.p_refuted, insufficient: debate.judge.p_insufficient }}
          grounding={debate.grounding}
          abstained={!!debate.abstained}
          hadDebate={debate.args.length > 0}
        />
      ) : (
        claim.status === 'done' &&
        claim.probs && (
          <div className="space-y-3 border-t pt-5">
            {claim.explanation && <p className="text-sm text-muted-foreground">{claim.explanation}</p>}
            <ProbabilityBar probs={claim.probs} />
          </div>
        )
      )}
      {debate && <EvidenceList evidence={debate.evidence} />}

      {claim.sources && claim.sources.length > 0 && (
        <ul className="space-y-2 border-t pt-4 text-sm">
          {claim.sources.map((s) => {
            let domain = s.url;
            try {
              domain = new URL(s.url).hostname.replace('www.', '');
            } catch {
              /* keep raw url */
            }
            return (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                  <img src={faviconUrl(domain)} alt="" className="h-4 w-4 rounded" />
                  <span className="truncate">{s.title || domain}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const STAGES: { key: XRayStage; label: string }[] = [
  { key: 'fetch', label: 'Reading article' },
  { key: 'extract', label: 'Finding claims' },
  { key: 'check', label: 'Checking claims' },
];

function Steps({ stages, claims, failed }: { stages: Record<XRayStage, string>; claims: LiveClaim[]; failed: boolean }) {
  const checked = claims.filter((c) => c.status === 'done').length;
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {STAGES.map((st) => {
        const status = stages[st.key];
        const isFailed = failed && status === 'active';
        return (
          <li
            key={st.key}
            className={cn(
              'flex items-center gap-2',
              isFailed ? 'text-destructive' : status === 'pending' ? 'text-muted-foreground/60' : 'text-foreground'
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                isFailed ? 'bg-destructive' : status === 'done' ? 'bg-foreground' : status === 'active' ? 'animate-pulse bg-primary' : 'bg-muted-foreground/40'
              )}
            />
            {st.label}
            {st.key === 'check' && claims.length > 0 && <span className="tabular-nums text-muted-foreground">{checked}/{claims.length}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export interface XRayViewProps {
  article: { title: string; url: string; text: string; truncated: boolean } | null;
  claims: LiveClaim[];
  summary?: XRaySummary;
  running: boolean;
  stages: Record<XRayStage, 'pending' | 'active' | 'done'>;
  notices?: string[];
  error?: string;
  /** Status, timer and buttons shown above the article */
  headerExtra?: ReactNode;
}

export function XRayView({ article, claims, summary, running, stages, notices = [], error, headerExtra }: XRayViewProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);

  // Until the reader picks a claim, follow the one being checked
  useEffect(() => {
    if (pinned || !claims.length) return;
    const active = claims.find((c) => c.status === 'debating') ?? claims.find((c) => c.status === 'searching');
    const next = active?.index ?? selected ?? claims[0].index;
    if (next !== selected) setSelected(next);
  }, [claims, pinned, selected]);

  const select = (i: number) => {
    setPinned(true);
    setSelected(i);
  };
  const current = claims.find((c) => c.index === selected);
  let domain = '';
  try {
    domain = article?.url ? new URL(article.url).hostname.replace('www.', '') : '';
  } catch {
    domain = '';
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">{headerExtra}</div>

        <header className="space-y-5">
          {domain && (
            <a href={article!.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <img src={faviconUrl(domain)} alt="" className="h-4 w-4 rounded" />
              {domain}
            </a>
          )}
          <h1 className="max-w-4xl font-serif text-3xl font-medium leading-tight tracking-tight sm:text-5xl">{article ? article.title : 'Reading article'}</h1>
          {running || error ? <Steps stages={stages} claims={claims} failed={!!error} /> : null}
        </header>

        {notices.map((n, i) => (
          <p key={i} className="border-l-2 border-warning pl-3 text-sm text-warning">
            {n}
          </p>
        ))}
        {error && <p className="border-l-2 border-destructive pl-3 text-sm text-destructive">{error}</p>}

        {(claims.length > 0 || (running && article)) && <Score claims={claims} summary={summary} running={running} />}

        {article && (
          <div className="grid gap-10 border-t pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14">
            <div>
              <HighlightedArticle text={article.text} claims={claims} selected={selected} onSelect={select} />
              {article.truncated && <p className="mt-6 text-sm text-muted-foreground">Only the first part of this article was scanned.</p>}
            </div>

            <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
              {claims.length > 0 && (
                <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Claims">
                  {claims.map((c) => (
                    <button
                      key={c.index}
                      role="tab"
                      aria-selected={selected === c.index}
                      onClick={() => select(c.index)}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-shadow',
                        numberClass(c),
                        selected === c.index && 'ring-2 ring-foreground/40 ring-offset-2 ring-offset-background'
                      )}
                    >
                      {c.index + 1}
                    </button>
                  ))}
                </div>
              )}
              {current ? (
                <ClaimInspector claim={current} />
              ) : (
                <p className="text-sm text-muted-foreground">{running ? 'Finding claims' : 'No claims to show.'}</p>
              )}
            </aside>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

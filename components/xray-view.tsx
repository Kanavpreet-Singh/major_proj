'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { faviconUrl } from '@/lib/format';
import {
  DebateHeader,
  DebateTranscript,
  EvidenceList,
  JudgeDeliberating,
  JudgeRuling,
  ProbabilityBar,
  type Role,
  type SlotState,
} from '@/components/debate-panel';
import type { LiveDebate } from '@/lib/use-analysis-stream';
import type { ClaimStatus, LiveClaim, XRayStage } from '@/lib/use-xray-stream';
import type { SubclaimDebate } from '@/lib/types';
import type { XRaySummary } from '@/lib/validations';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Gavel,
  Globe,
  HelpCircle,
  Loader2,
  MousePointerClick,
  ScanLine,
  Search,
  XCircle,
} from 'lucide-react';

type Label = 'supported' | 'not_supported' | 'insufficient';

const LABEL_META: Record<Label, { text: string; short: string; mark: string; dot: string; badge: string; icon: typeof Check }> = {
  supported: {
    text: 'Holds up',
    short: 'True',
    mark: 'bg-emerald-500/15 decoration-emerald-500 hover:bg-emerald-500/25',
    dot: 'bg-emerald-500 text-white',
    badge: 'bg-success/15 text-success border-success/30',
    icon: CheckCircle2,
  },
  not_supported: {
    text: 'False',
    short: 'False',
    mark: 'bg-rose-500/15 decoration-rose-500 hover:bg-rose-500/25',
    dot: 'bg-rose-500 text-white',
    badge: 'bg-destructive/15 text-destructive border-destructive/30',
    icon: XCircle,
  },
  insufficient: {
    text: 'Unverified',
    short: 'Unverified',
    mark: 'bg-amber-500/15 decoration-amber-500 hover:bg-amber-500/25',
    dot: 'bg-amber-500 text-white',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    icon: HelpCircle,
  },
};

const PENDING_MARK: Record<Exclude<ClaimStatus, 'done'>, string> = {
  queued: 'bg-muted decoration-muted-foreground/40',
  searching: 'bg-sky-500/10 decoration-sky-500/70 animate-pulse',
  debating: 'bg-violet-500/15 decoration-violet-500 animate-pulse',
};

const STATUS_TEXT: Record<ClaimStatus, string> = {
  queued: 'Waiting to be checked',
  searching: 'Searching the web for evidence',
  debating: 'Defender and Prosecutor are debating',
  done: 'Checked',
};

/** A saved debate rendered through the same pieces as a live one. */
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

function markClass(c: LiveClaim) {
  if (c.status === 'done' && c.label) return LABEL_META[c.label as Label].mark;
  return PENDING_MARK[c.status === 'done' ? 'queued' : c.status];
}

function dotClass(c: LiveClaim) {
  if (c.status === 'done' && c.label) return LABEL_META[c.label as Label].dot;
  if (c.status === 'debating') return 'bg-violet-500 text-white';
  if (c.status === 'searching') return 'bg-sky-500 text-white';
  return 'bg-muted-foreground/30 text-foreground';
}

// ──────────────────────────────────────────────────────── Truth meter

function TruthMeter({ claims, summary, running }: { claims: LiveClaim[]; summary?: XRaySummary; running: boolean }) {
  const count = (l: Label) => claims.filter((c) => c.status === 'done' && c.label === l).length;
  const sup = count('supported');
  const ref = count('not_supported');
  const ins = count('insufficient');
  const pending = claims.length - sup - ref - ins;
  const total = Math.max(1, claims.length);
  const decided = sup + ref;
  const score = summary?.truth_score ?? (decided ? sup / decided : null);

  const segs = [
    { n: sup, cls: 'bg-emerald-500', label: 'Hold up' },
    { n: ref, cls: 'bg-rose-500', label: 'False' },
    { n: ins, cls: 'bg-amber-500', label: 'Unverified' },
    { n: pending, cls: 'bg-muted-foreground/25 animate-pulse', label: 'Checking' },
  ];

  return (
    <Card className="rounded-2xl border">
      <CardContent className="flex flex-wrap items-center gap-6 p-5">
        <div className="min-w-[150px]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Truth score</div>
          <div className="text-4xl font-black tabular-nums tracking-tight">
            {score == null ? '–' : `${Math.round(score * 100)}%`}
          </div>
          <div className="text-xs text-muted-foreground">
            {claims.length === 0
              ? running
                ? 'Finding claims…'
                : 'No claims found'
              : `${sup} of ${decided || 0} decided claim${decided === 1 ? '' : 's'} hold up`}
          </div>
        </div>
        <div className="min-w-[220px] flex-1 space-y-2">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {segs.map((s, i) =>
              s.n > 0 ? <div key={i} className={cn('h-full transition-all duration-700', s.cls)} style={{ width: `${(s.n / total) * 100}%` }} /> : null
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {segs.map((s, i) =>
              s.n > 0 || i < 3 ? (
                <span key={i} className="inline-flex items-center gap-1.5 tabular-nums">
                  <span className={cn('h-2 w-2 rounded-full', s.cls)} />
                  {s.n} {s.label}
                </span>
              ) : null
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────── Article with highlights

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
    <div className="space-y-4 text-[15px] leading-7 text-foreground/90">
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
              onClick={() => onSelect(c.index)}
              onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && onSelect(c.index)}
              className={cn(
                'cursor-pointer rounded-sm px-0.5 text-foreground underline decoration-2 underline-offset-4 transition-colors [box-decoration-break:clone]',
                markClass(c),
                selected === c.index && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
              )}
            >
              {text.slice(s, e)}
              {e === c.end && (
                <sup
                  className={cn(
                    'ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold no-underline',
                    dotClass(c)
                  )}
                >
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

// ──────────────────────────────────────────────────────── Claim inspector

function ClaimInspector({ claim, total }: { claim: LiveClaim; total: number }) {
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
  const label = claim.status === 'done' ? (claim.label as Label | undefined) : undefined;
  const meta = label ? LABEL_META[label] : null;
  const Icon = meta?.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold', dotClass(claim))}>
            {claim.index + 1}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Claim {claim.index + 1} of {total}
          </span>
        </div>
        {meta && Icon ? (
          <Badge variant="outline" className={cn('gap-1 border text-xs font-semibold', meta.badge)}>
            <Icon className="h-3.5 w-3.5" /> {meta.text}
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1.5 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" /> {claim.status === 'queued' ? 'Queued' : 'Checking'}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Claim as checked</div>
          <p className="text-sm font-semibold leading-snug">{claim.claim}</p>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">In the article</div>
          <p className="border-l-2 border-border pl-2 text-xs italic leading-relaxed text-muted-foreground">&ldquo;{claim.quote}&rdquo;</p>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="outline" className="text-[10px] capitalize">{claim.category}</Badge>
          <Badge variant="outline" className="text-[10px] tabular-nums">check-worthiness {Math.round(claim.checkworthiness * 100)}%</Badge>
          {claim.evidenceCount != null && (
            <Badge variant="outline" className="text-[10px] tabular-nums">{claim.evidenceCount} evidence passages</Badge>
          )}
        </div>
      </div>

      {claim.status !== 'done' && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          <span className="truncate">{claim.activity || STATUS_TEXT[claim.status]}</span>
        </div>
      )}

      {debate && (debate.args.length > 0 || debate.thinking.length > 0) && (
        <div className="space-y-3">
          <DebateHeader />
          <DebateTranscript args={debate.args} evidence={evidence} rounds={debate.rounds} slot={slot} />
        </div>
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
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <p className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
              Decided without a debate{claim.method === 'error' ? '' : ` (${claim.method === 'single' ? 'single model' : 'keyword fallback'})`}
            </p>
            {claim.explanation && <p className="mb-2 text-xs text-muted-foreground">{claim.explanation}</p>}
            <ProbabilityBar probs={claim.probs} />
          </div>
        )
      )}
      {debate && <EvidenceList evidence={debate.evidence} />}

      {claim.sources && claim.sources.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sources consulted</div>
          {claim.sources.map((s) => {
            let domain = '';
            try {
              domain = new URL(s.url).hostname.replace('www.', '');
            } catch {
              domain = s.url;
            }
            return (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs hover:underline">
                <img src={faviconUrl(domain)} alt="" className="h-4 w-4 rounded" />
                <span className="truncate">{s.title || domain}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────── Stages

const STAGES: { key: XRayStage; label: string; icon: typeof Search }[] = [
  { key: 'fetch', label: 'Read article', icon: Globe },
  { key: 'extract', label: 'Find claims', icon: FileSearch },
  { key: 'check', label: 'Fact-check', icon: Gavel },
];

function StageStrip({ stages, claims, failed }: { stages: Record<XRayStage, string>; claims: LiveClaim[]; failed: boolean }) {
  const done = claims.filter((c) => c.status === 'done').length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STAGES.map((st, i) => {
        const status = stages[st.key];
        const Icon = st.icon;
        const isFailed = failed && status === 'active';
        return (
          <div key={st.key} className="flex items-center gap-2">
            {i > 0 && <span className={cn('h-px w-6', status === 'pending' ? 'bg-border' : 'bg-primary/60')} />}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                isFailed && 'border-destructive/50 bg-destructive/10 text-destructive',
                !isFailed && status === 'pending' && 'text-muted-foreground',
                !isFailed && status === 'active' && 'border-primary/50 bg-primary/10 text-primary',
                !isFailed && status === 'done' && 'border-primary bg-primary text-primary-foreground'
              )}
            >
              {isFailed ? (
                <XCircle className="h-3.5 w-3.5" />
              ) : status === 'done' ? (
                <Check className="h-3.5 w-3.5" />
              ) : status === 'active' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              {st.label}
              {st.key === 'check' && claims.length > 0 && <span className="tabular-nums opacity-80">{done}/{claims.length}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────── Main view

export interface XRayViewProps {
  article: { title: string; url: string; text: string; truncated: boolean } | null;
  claims: LiveClaim[];
  summary?: XRaySummary;
  running: boolean;
  stages: Record<XRayStage, 'pending' | 'active' | 'done'>;
  notices?: string[];
  error?: string;
  /** Status badge, timer and buttons for the header */
  headerExtra?: ReactNode;
}

export function XRayView({ article, claims, summary, running, stages, notices = [], error, headerExtra }: XRayViewProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);

  // Until the viewer picks a claim, follow the action: the claim currently being debated
  useEffect(() => {
    if (pinned || !claims.length) return;
    const active = claims.find((c) => c.status === 'debating') ?? claims.find((c) => c.status === 'searching');
    const next = active?.index ?? (selected ?? claims[0].index);
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
      <div className="space-y-6">
        {/* Header */}
        <Card className="overflow-hidden rounded-2xl border">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-r from-sky-500/[0.07] via-violet-500/[0.07] to-rose-500/[0.07] px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ScanLine className="h-4 w-4 text-primary" />
              Article X-Ray
            </div>
            <div className="flex items-center gap-3">{headerExtra}</div>
          </div>
          <CardContent className="space-y-4 p-5">
            {article ? (
              <div className="space-y-1.5">
                {domain && (
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:underline">
                    <img src={faviconUrl(domain)} alt="" className="h-4 w-4 rounded" />
                    {domain}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <h1 className="text-xl font-bold leading-snug sm:text-2xl">{article.title}</h1>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Reading the article…
              </div>
            )}
            <StageStrip stages={stages} claims={claims} failed={!!error} />
          </CardContent>
        </Card>

        {notices.map((n, i) => (
          <div key={i} className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {n}
          </div>
        ))}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">The scan could not finish</p>
              <p className="mt-1 break-words opacity-90">{error}</p>
            </div>
          </div>
        )}

        {(claims.length > 0 || running) && <TruthMeter claims={claims} summary={summary} running={running} />}

        {article && (
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Article */}
            <Card className="rounded-2xl border lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
                  <span>Article</span>
                  {claims.length > 0 && (
                    <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                      <MousePointerClick className="h-3.5 w-3.5" /> Click a highlight to inspect it
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <HighlightedArticle text={article.text} claims={claims} selected={selected} onSelect={select} />
                {article.truncated && (
                  <p className="mt-4 text-xs text-muted-foreground">The article was long, so only its first part was scanned.</p>
                )}
              </CardContent>
            </Card>

            {/* Inspector */}
            <div className="lg:col-span-2">
              <div className="space-y-4 lg:sticky lg:top-20">
                {claims.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {claims.map((c) => (
                      <button
                        key={c.index}
                        onClick={() => select(c.index)}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all',
                          dotClass(c),
                          c.status !== 'done' && c.status !== 'queued' && 'animate-pulse',
                          selected === c.index && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                        )}
                        aria-label={`Claim ${c.index + 1}`}
                      >
                        {c.index + 1}
                      </button>
                    ))}
                  </div>
                )}
                <Card className="rounded-2xl border">
                  <CardContent className="max-h-[calc(100vh-10rem)] overflow-y-auto p-5">
                    {current ? (
                      <ClaimInspector claim={current} total={claims.length} />
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                        {running ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileSearch className="h-6 w-6" />}
                        {running ? 'Looking for check-worthy claims…' : 'No claims to show.'}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

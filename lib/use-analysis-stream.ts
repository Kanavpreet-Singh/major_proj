'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { DebateArgument, DebateEvidence, LabelProbs, SubclaimDebate } from '@/lib/types';

export type StageKey = 'extract' | 'decompose' | 'queries' | 'evidence' | 'debate' | 'verdict';
export type StageStatus = 'pending' | 'active' | 'done';

export interface LiveDebate {
  subclaim: string;
  evidence: DebateEvidence[];
  rounds: number;
  args: DebateArgument[];
  thinking: string[]; // `${role}-${round}`
  failed: string[];
  judging: boolean;
  judge?: SubclaimDebate['judge'];
  label?: SubclaimDebate['verdict'];
  abstained?: boolean;
  grounding?: SubclaimDebate['grounding'];
}

export interface LogLine {
  t: number;
  text: string;
  tone: 'info' | 'defender' | 'prosecutor' | 'judge' | 'warn' | 'error' | 'success';
}

export interface LiveState {
  status: 'idle' | 'running' | 'done' | 'error';
  startedAt: number;
  input: { claim: string; type: string } | null;
  stages: Record<StageKey, StageStatus>;
  activity: string;
  subclaims: string[];
  queries: string[][];
  evidence: Record<number, { count: number; sources: { name: string; url: string }[] }>;
  debates: Record<number, LiveDebate>;
  verdicts: Record<number, { verdict: SubclaimDebate['verdict']; probs: LabelProbs; method: string }>;
  notices: { level: string; message: string }[];
  final?: { final: string; probs: LabelProbs };
  done?: { id: string; label: string; confidence: number; elapsedMs: number };
  error?: string;
  pdf?: { pages: number; ocr: boolean; claim: string };
  log: LogLine[];
}

const NO_STAGES: Record<StageKey, StageStatus> = {
  extract: 'pending', decompose: 'pending', queries: 'pending', evidence: 'pending', debate: 'pending', verdict: 'pending',
};

const initial: LiveState = {
  status: 'idle', startedAt: 0, input: null, stages: NO_STAGES, activity: '', subclaims: [], queries: [],
  evidence: {}, debates: {}, verdicts: {}, notices: [], log: [],
};

const STAGE_TEXT: Record<StageKey, string> = {
  extract: 'Extracting text from the PDF',
  decompose: 'Breaking the claim into checkable subclaims',
  queries: 'Planning web searches',
  evidence: 'Searching the web and reading sources',
  debate: 'Opening the debate',
  verdict: 'Combining the rulings',
};

const roleName = (r: string) => (r === 'defender' ? 'Defender' : 'Prosecutor');
const LABEL_TEXT: Record<string, string> = { supported: 'Supported', not_supported: 'Refuted', insufficient: 'Insufficient evidence' };

type Action =
  | { type: 'start'; claim: string; inputType: string }
  | { type: 'event'; e: Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any
  | { type: 'fail'; message: string }
  | { type: 'reset' };

function reducer(s: LiveState, a: Action): LiveState {
  if (a.type === 'reset') return initial;
  if (a.type === 'start') {
    return { ...initial, status: 'running', startedAt: Date.now(), input: { claim: a.claim, type: a.inputType } };
  }
  if (a.type === 'fail') {
    return { ...s, status: 'error', error: a.message, log: [...s.log, { t: Date.now(), text: a.message, tone: 'error' }] };
  }

  const e = a.e;
  const log = (text: string, tone: LogLine['tone'] = 'info') => [...s.log, { t: Date.now(), text, tone }];
  const i: number = e.subclaim_index ?? 0;
  const debate = (patch: Partial<LiveDebate>): Record<number, LiveDebate> => ({
    ...s.debates,
    [i]: { ...(s.debates[i] as LiveDebate), ...patch },
  });
  const slot = (role: string, round: number) => `${role}-${round}`;

  switch (e.event) {
    case 'stage': {
      const stage = e.stage as StageKey;
      const stages = { ...s.stages, [stage]: e.status === 'start' ? 'active' : 'done' } as LiveState['stages'];
      if (stage === 'debate' && e.status === 'done') stages.verdict = 'active';
      if (stage === 'extract' && e.status === 'done') {
        return {
          ...s, stages, pdf: { pages: e.pages, ocr: e.ocr, claim: e.claim },
          log: log(`Read ${e.pages} page(s) using ${e.ocr ? 'OCR' : 'text extraction'}`, 'success'),
        };
      }
      if (e.status !== 'start') return { ...s, stages };
      return { ...s, stages, activity: STAGE_TEXT[stage], log: log(STAGE_TEXT[stage]) };
    }
    case 'subclaims':
      return { ...s, subclaims: e.items, log: log(`Found ${e.items.length} subclaim(s) to verify`, 'success') };
    case 'queries': {
      const n = (e.items as string[][]).reduce((k, q) => k + q.length, 0);
      return { ...s, queries: e.items, log: log(`Planned ${n} search queries`, 'success') };
    }
    case 'search':
      return { ...s, activity: `Searching: “${e.query}”`, log: log(`Search: ${e.query}`) };
    case 'evidence':
      return {
        ...s,
        evidence: { ...s.evidence, [i]: { count: e.count, sources: e.sources } },
        log: log(`Subclaim ${i + 1}: collected ${e.count} evidence passage(s)`, e.count ? 'success' : 'warn'),
      };
    case 'debate_start':
      return {
        ...s,
        activity: `Debate on subclaim ${i + 1} is starting`,
        debates: {
          ...s.debates,
          [i]: { subclaim: e.subclaim, evidence: e.evidence, rounds: e.rounds, args: [], thinking: [], failed: [], judging: false },
        },
        log: log(`Debate opened on subclaim ${i + 1} with ${e.evidence.length} evidence passage(s)`),
      };
    case 'thinking':
      return {
        ...s,
        activity: `${roleName(e.role)} is drafting ${e.round === 1 ? 'an opening argument' : 'a rebuttal'}`,
        debates: debate({ thinking: [...(s.debates[i]?.thinking ?? []), slot(e.role, e.round)] }),
      };
    case 'argument': {
      const arg = e.argument as DebateArgument;
      const d = s.debates[i];
      const ok = arg.citations.filter((c) => c.verified).length;
      return {
        ...s,
        debates: debate({
          args: [...(d?.args ?? []), arg],
          thinking: (d?.thinking ?? []).filter((k) => k !== slot(arg.role, arg.round)),
        }),
        log: log(
          `${roleName(arg.role)} · round ${arg.round}: ${arg.citations.length} citation(s), ${ok} verified${arg.conceded ? ' · concedes' : ''}`,
          arg.role
        ),
      };
    }
    case 'argument_failed': {
      const d = s.debates[i];
      const k = slot(e.role, e.round);
      return {
        ...s,
        debates: debate({ thinking: (d?.thinking ?? []).filter((x) => x !== k), failed: [...(d?.failed ?? []), k] }),
        log: log(`${roleName(e.role)} failed to respond in round ${e.round}`, 'error'),
      };
    }
    case 'judging':
      return { ...s, activity: 'The Judge is deliberating', debates: debate({ judging: true }), log: log('Judge is deliberating', 'judge') };
    case 'judge': {
      const label = e.label as SubclaimDebate['verdict'];
      const top = Math.max(e.judge.p_supported, e.judge.p_refuted, e.judge.p_insufficient);
      return {
        ...s,
        debates: debate({ judging: false, judge: e.judge, label, abstained: e.abstained, grounding: e.grounding }),
        log: log(`Ruling on subclaim ${i + 1}: ${LABEL_TEXT[label]} (${Math.round(top * 100)}%)`, 'judge'),
      };
    }
    case 'subclaim_verdict':
      return { ...s, verdicts: { ...s.verdicts, [i]: { verdict: e.verdict, probs: e.probs, method: e.method } } };
    case 'notice':
      return {
        ...s,
        notices: [...s.notices, { level: e.level, message: e.message }],
        log: log(e.message, e.level === 'error' ? 'error' : 'warn'),
      };
    case 'verdict':
      return {
        ...s,
        stages: { ...s.stages, verdict: 'done' },
        final: { final: e.final, probs: e.probs },
        log: log(`Final verdict computed: ${e.final.replace(/_/g, ' ').toLowerCase()}`, 'success'),
      };
    case 'done':
      return {
        ...s,
        status: 'done',
        stages: Object.fromEntries(Object.entries(s.stages).map(([k, v]) => [k, v === 'pending' ? 'pending' : 'done'])) as LiveState['stages'],
        done: { id: e.id, label: e.label, confidence: e.confidence, elapsedMs: e.elapsedMs },
        activity: '',
        log: log('Report saved', 'success'),
      };
    case 'error':
      return { ...s, status: 'error', error: e.message, activity: '', log: log(e.message, 'error') };
    default:
      return s;
  }
}

/** Starts an analysis via /api/analyze/stream and folds its Server-Sent Events into state. */
export function useAnalysisStream() {
  const [state, dispatch] = useReducer(reducer, initial);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const start = useCallback(
    async (payload: { imageUrl: string; claim: string; language: string; type: string }) => {
      cancel();
      const ctl = new AbortController();
      abortRef.current = ctl;
      dispatch({ type: 'start', claim: payload.claim, inputType: payload.type });
      try {
        const res = await fetch('/api/analyze/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctl.signal,
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Request failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let finished = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const frames = buf.split('\n\n');
          buf = frames.pop() ?? '';
          for (const frame of frames) {
            const data = frame
              .split('\n')
              .filter((l) => l.startsWith('data: '))
              .map((l) => l.slice(6))
              .join('\n');
            if (!data) continue;
            const e = JSON.parse(data);
            if (e.event === 'done' || e.event === 'error') finished = true;
            dispatch({ type: 'event', e });
          }
        }
        if (!finished) throw new Error('The connection closed before the analysis finished.');
      } catch (err) {
        if (ctl.signal.aborted) return;
        dispatch({ type: 'fail', message: err instanceof Error ? err.message : 'Analysis failed' });
      }
    },
    [cancel]
  );

  const reset = useCallback(() => {
    cancel();
    dispatch({ type: 'reset' });
  }, [cancel]);

  // Leaving the page stops the analysis on the server too
  useEffect(() => cancel, [cancel]);

  return { state, start, cancel, reset };
}

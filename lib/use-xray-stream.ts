'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { postSSE } from '@/lib/sse-client';
import type { LiveDebate } from '@/lib/use-analysis-stream';
import type { XRayClaim, XRaySummary } from '@/lib/validations';
import type { DebateArgument } from '@/lib/types';

export type ClaimStatus = 'queued' | 'searching' | 'debating' | 'done';
export type XRayStage = 'fetch' | 'extract' | 'check';

export interface LiveClaim extends XRayClaim {
  status: ClaimStatus;
  activity?: string;
  evidenceCount?: number;
  live?: LiveDebate;
}

export interface XRayState {
  status: 'idle' | 'running' | 'done' | 'error';
  startedAt: number;
  stages: Record<XRayStage, 'pending' | 'active' | 'done'>;
  article: { title: string; url: string; text: string; truncated: boolean } | null;
  claims: LiveClaim[];
  notices: string[];
  summary?: XRaySummary;
  done?: { id: string; elapsedMs: number };
  error?: string;
}

const initial: XRayState = {
  status: 'idle',
  startedAt: 0,
  stages: { fetch: 'pending', extract: 'pending', check: 'pending' },
  article: null,
  claims: [],
  notices: [],
};

type Action =
  | { type: 'start' }
  | { type: 'event'; e: Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any
  | { type: 'fail'; message: string }
  | { type: 'reset' };

function reducer(s: XRayState, a: Action): XRayState {
  if (a.type === 'reset') return initial;
  if (a.type === 'start') return { ...initial, status: 'running', startedAt: Date.now() };
  if (a.type === 'fail') return { ...s, status: 'error', error: a.message };

  const e = a.e;
  const i: number | undefined = e.claim_index;
  const patchClaim = (patch: (c: LiveClaim) => Partial<LiveClaim>): XRayState =>
    i === undefined ? s : { ...s, claims: s.claims.map((c) => (c.index === i ? { ...c, ...patch(c) } : c)) };
  const patchLive = (patch: (d: LiveDebate) => Partial<LiveDebate>) =>
    patchClaim((c) => (c.live ? { live: { ...c.live, ...patch(c.live) } } : {}));
  const slot = (role: string, round: number) => `${role}-${round}`;

  switch (e.event) {
    case 'stage':
      return { ...s, stages: { ...s.stages, [e.stage]: e.status === 'start' ? 'active' : 'done' } };
    case 'article':
      return { ...s, article: { title: e.title, url: e.url, text: e.text, truncated: e.truncated } };
    case 'claims':
      return { ...s, claims: (e.items as XRayClaim[]).map((c) => ({ ...c, status: 'queued' })) };
    case 'claim_status':
      return patchClaim(() => ({ status: e.status, activity: e.status === 'searching' ? 'Searching the web' : 'Agents are debating' }));
    case 'search':
      return patchClaim(() => ({ activity: `Searching: “${e.query}”` }));
    case 'evidence':
      return patchClaim(() => ({ evidenceCount: e.count }));
    case 'debate_start':
      return patchClaim(() => ({
        live: { subclaim: e.subclaim, evidence: e.evidence, rounds: e.rounds, args: [], thinking: [], failed: [], judging: false },
      }));
    case 'thinking':
      return patchLive((d) => ({ thinking: [...d.thinking, slot(e.role, e.round)] }));
    case 'argument': {
      const arg = e.argument as DebateArgument;
      return patchLive((d) => ({ args: [...d.args, arg], thinking: d.thinking.filter((k) => k !== slot(arg.role, arg.round)) }));
    }
    case 'argument_failed':
      return patchLive((d) => ({
        thinking: d.thinking.filter((k) => k !== slot(e.role, e.round)),
        failed: [...d.failed, slot(e.role, e.round)],
      }));
    case 'judging':
      return patchLive(() => ({ judging: true }));
    case 'judge':
      return patchLive(() => ({ judging: false, judge: e.judge, label: e.label, abstained: e.abstained, grounding: e.grounding }));
    case 'claim_result':
      return patchClaim(() => ({
        status: 'done',
        activity: undefined,
        label: e.label,
        probs: e.probs,
        explanation: e.explanation,
        method: e.method,
        debate: e.debate,
        sources: e.sources,
      }));
    case 'notice':
      return s.notices.includes(e.message) ? s : { ...s, notices: [...s.notices, e.message] };
    case 'summary':
      return { ...s, summary: { total: e.total, supported: e.supported, not_supported: e.not_supported, insufficient: e.insufficient, truth_score: e.truth_score } };
    case 'done':
      return { ...s, status: 'done', done: { id: e.id, elapsedMs: e.elapsedMs } };
    case 'error':
      return { ...s, status: 'error', error: e.message };
    default:
      return s;
  }
}

/** Runs an Article X-Ray via /api/xray/stream and folds its events into state. */
export function useXRayStream() {
  const [state, dispatch] = useReducer(reducer, initial);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const start = useCallback(
    async (input: { url?: string; text?: string }) => {
      cancel();
      const ctl = new AbortController();
      abortRef.current = ctl;
      dispatch({ type: 'start' });
      try {
        await postSSE('/api/xray/stream', input, (e) => dispatch({ type: 'event', e }), ctl.signal);
      } catch (err) {
        if (ctl.signal.aborted) return;
        dispatch({ type: 'fail', message: err instanceof Error ? err.message : 'Scan failed' });
      }
    },
    [cancel]
  );

  const reset = useCallback(() => {
    cancel();
    dispatch({ type: 'reset' });
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return { state, start, cancel, reset };
}

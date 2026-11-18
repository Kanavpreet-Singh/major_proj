import { spawn } from 'child_process';
import path from 'path';
import { mlResponseSchema, type MLResponse } from '@/lib/validations';

/** A progress event from the Python pipeline (see src/utils/events.py). */
export type PipelineEvent = { event: string; [key: string]: unknown };

export interface PipelineInput {
  imageUrl: string;
  claim: string;
  language: string;
  type: 'text' | 'pdf' | 'image-text';
}

// A debate can take several minutes; this is only a safety net against a hung process.
const PIPELINE_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS ?? 10 * 60 * 1000);

/**
 * Runs the ML pipeline and resolves with its result, calling `onEvent` for each
 * progress event as it happens.
 *
 * Uses the ML HTTP service (ML_API_URL) when it is reachable. If it is not running,
 * the pipeline is run as a local Python process instead. Only a refused connection
 * triggers that fallback: a slow or failed analysis is never silently re-run.
 */
export async function runPipeline(
  input: PipelineInput,
  onEvent: (e: PipelineEvent) => void = () => {},
  signal?: AbortSignal
): Promise<MLResponse> {
  const raw = process.env.ML_API_URL;
  const apiUrl = raw ? raw.replace('//localhost', '//127.0.0.1').replace(/\/$/, '') : null;

  if (apiUrl) {
    try {
      return await runViaService(apiUrl, input, onEvent, signal);
    } catch (err) {
      if (!isConnectionRefused(err)) throw err;
      console.info(`[ml] ML service at ${apiUrl} is not running; using local Python instead.`);
    }
  }
  return runLocal(input, onEvent, signal);
}

function isConnectionRefused(err: unknown): boolean {
  const cause = (err as { cause?: { code?: string } })?.cause;
  return cause?.code === 'ECONNREFUSED' || cause?.code === 'ENOTFOUND';
}

/** Splits a byte stream into lines and hands each parsed JSON line to `onLine`. */
function lineParser(onLine: (obj: Record<string, unknown>) => void) {
  let buf = '';
  return (chunk: string, flush = false) => {
    buf += chunk;
    const lines = buf.split('\n');
    buf = flush ? '' : lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('{')) continue;
      try {
        onLine(JSON.parse(t));
      } catch {
        // not a JSON line (stray print); ignore
      }
    }
  };
}

async function runViaService(
  apiUrl: string,
  input: PipelineInput,
  onEvent: (e: PipelineEvent) => void,
  signal?: AbortSignal
): Promise<MLResponse> {
  // Abort on client disconnect or timeout (AbortSignal.any is not in this TS lib)
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(new Error('Analysis timed out.')), PIPELINE_TIMEOUT_MS);
  signal?.addEventListener('abort', () => ctl.abort(signal.reason));
  try {
    return await readServiceStream(apiUrl, input, onEvent, ctl.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function readServiceStream(
  apiUrl: string,
  input: PipelineInput,
  onEvent: (e: PipelineEvent) => void,
  signal: AbortSignal
): Promise<MLResponse> {
  const res = await fetch(`${apiUrl}/analyze/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ML_API_KEY ?? '' },
    body: JSON.stringify({ image_url: input.imageUrl, claim: input.claim, language: input.language, type: input.type }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`ML service returned ${res.status}: ${await res.text().catch(() => '')}`);
  }

  let result: MLResponse | null = null;
  let failure: string | null = null;
  const parse = lineParser((obj) => {
    if (obj.event === 'result') result = mlResponseSchema.parse(obj.result);
    else if (obj.event === 'error') failure = String(obj.message);
    else if (typeof obj.event === 'string') onEvent(obj as PipelineEvent);
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parse(decoder.decode(value, { stream: true }));
  }
  parse('', true);

  if (failure) throw new Error(failure);
  if (!result) throw new Error('ML service ended without a result.');
  return result;
}

function runLocal(
  input: PipelineInput,
  onEvent: (e: PipelineEvent) => void,
  signal?: AbortSignal
): Promise<MLResponse> {
  return new Promise((resolve, reject) => {
    const py = spawn('python', [path.join(process.cwd(), 'ml', 'predict.py')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, HF_HOME: process.env.HF_HOME ?? 'E:\\.cache\\huggingface', PYTHONUNBUFFERED: '1' },
    });

    let result: MLResponse | null = null;
    let lastJson: Record<string, unknown> | null = null;
    let stderr = '';
    let settled = false;

    const finish = (err: Error | null, value?: MLResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (err) reject(err);
      else resolve(value!);
    };

    const timer = setTimeout(() => {
      py.kill();
      finish(new Error(`Analysis timed out after ${Math.round(PIPELINE_TIMEOUT_MS / 1000)}s.`));
    }, PIPELINE_TIMEOUT_MS);

    // If the browser disconnects, stop the analysis instead of burning LLM quota
    const onAbort = () => {
      py.kill();
      finish(new Error('Analysis cancelled.'));
    };
    signal?.addEventListener('abort', onAbort);

    const parse = lineParser((obj) => {
      if (typeof obj.event === 'string') onEvent(obj as PipelineEvent);
      else lastJson = obj; // the final result line has no "event" key
    });

    py.stdout.on('data', (chunk) => parse(chunk.toString()));
    py.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-20_000); // keep the tail for error reports
    });
    py.on('error', (err) => finish(err));
    py.on('close', (code) => {
      parse('', true);
      if (lastJson && 'label' in lastJson) {
        try {
          result = mlResponseSchema.parse(lastJson);
          return finish(null, result);
        } catch (err) {
          return finish(err instanceof Error ? err : new Error(String(err)));
        }
      }
      const reason = stderr.split('\n').reverse().find((l) => l.trim()) ?? 'no output';
      finish(new Error(`Python process exited with code ${code}: ${reason.replace(/\x1b\[[0-9;]*m/g, '')}`));
    });

    py.stdin.write(JSON.stringify(input));
    py.stdin.end();
  });
}

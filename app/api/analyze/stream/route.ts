import { NextRequest, NextResponse } from 'next/server';
import { analyzeInputSchema } from '@/lib/validations';
import { getOrCreateSessionId } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { saveResult } from '@/lib/db/repository';
import { runPipeline } from '@/lib/ml-runner';
import { sseResponse } from '@/lib/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

/**
 * Runs an analysis and streams its progress as Server-Sent Events: pipeline stages,
 * evidence, each debate argument as it is written, the judge's ruling, and finally
 * `{event: "done", id}` once the record is saved (or `{event: "error", message}`).
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = analyzeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { imageUrl, claim, language, type } = parsed.data;
  const sessionId = getOrCreateSessionId();
  if (!checkRateLimit(sessionId).allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait a minute and try again.' }, { status: 429 });
  }

  return sseResponse(async (send) => {
    const started = Date.now();
    send({ event: 'started', type: type || 'image-text' });
    const result = await runPipeline({ imageUrl, claim, language, type: type || 'image-text' }, send, req.signal);
    const id = await saveResult({ imageUrl, claim }, sessionId, result);
    send({ event: 'done', id, label: result.label, confidence: result.confidence, elapsedMs: Date.now() - started });
  });
}

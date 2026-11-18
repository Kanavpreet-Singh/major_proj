import { NextRequest, NextResponse } from 'next/server';
import { xrayInputSchema, xrayResultSchema } from '@/lib/validations';
import { getOrCreateSessionId } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { saveXRay } from '@/lib/db/xray-repository';
import { runPipeline } from '@/lib/ml-runner';
import { sseResponse } from '@/lib/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 900;

/**
 * Article X-Ray: fetches an article (or takes pasted text), finds its check-worthy claims
 * and fact-checks each one, streaming progress as Server-Sent Events. Ends with
 * `{event: "done", id}` once the scan is saved.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = xrayInputSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Validation failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const sessionId = getOrCreateSessionId();
  if (!checkRateLimit(sessionId).allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait a minute and try again.' }, { status: 429 });
  }

  const { url, text } = parsed.data;
  return sseResponse(async (send) => {
    const started = Date.now();
    send({ event: 'started' });
    const result = await runPipeline(
      { imageUrl: url ?? 'text-only', claim: text ?? '', language: 'en', type: 'xray' },
      send,
      req.signal,
      (raw) => xrayResultSchema.parse(raw)
    );
    const id = await saveXRay(result, sessionId);
    send({ event: 'done', id, elapsedMs: Date.now() - started });
  });
}

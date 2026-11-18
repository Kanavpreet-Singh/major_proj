import { NextRequest, NextResponse } from 'next/server';
import { analyzeInputSchema } from '@/lib/validations';
import { getOrCreateSessionId } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { saveResult } from '@/lib/db/repository';
import { runPipeline } from '@/lib/ml-runner';

export const runtime = 'nodejs';
export const maxDuration = 600;

/** Runs an analysis and returns the saved record id once it finishes. See ./stream for live progress. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = analyzeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { imageUrl, claim, language, type } = parsed.data;
  const sessionId = getOrCreateSessionId();

  if (!checkRateLimit(sessionId).allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a minute and try again.' },
      { status: 429 }
    );
  }

  try {
    const result = await runPipeline({ imageUrl, claim, language, type: type || 'image-text' }, undefined, req.signal);
    const id = await saveResult({ imageUrl, claim }, sessionId, result);
    return NextResponse.json({ id, isMock: false });
  } catch (err) {
    // Never return mock data - surface an explicit error to the frontend
    console.error('Analysis failed:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `ML Model Error: ${msg}` }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { analyzeInputSchema, mlResponseSchema } from '@/lib/validations';
import { getOrCreateSessionId } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { generateMockResult } from '@/lib/mock';
import { db } from '@/lib/db/client';
import { analyses } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

  const { imageUrl, claim, language } = parsed.data;
  const sessionId = getOrCreateSessionId();

  const rateLimit = checkRateLimit(sessionId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a minute and try again.' },
      { status: 429 }
    );
  }

  const mlApiUrl = process.env.ML_API_URL;
  const mlApiKey = process.env.ML_API_KEY;
  let isMock = false;
  let result;

  if (mlApiUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      const res = await fetch(`${mlApiUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': mlApiKey ?? '',
        },
        body: JSON.stringify({
          image_url: imageUrl,
          claim,
          language,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`ML API returned ${res.status}`);
      }

      const raw = await res.json();
      result = mlResponseSchema.parse(raw);
    } catch {
      isMock = true;
      result = generateMockResult(claim, language);
    }
  } else {
    isMock = true;
    result = generateMockResult(claim, language);
  }

  const [inserted] = await db
    .insert(analyses)
    .values({
      sessionId,
      imageUrl,
      claim,
      language: result.language,
      label: result.label,
      confidence: result.confidence,
      clipScore: result.clipScore,
      evidenceScore: result.evidenceScore,
      credibilityScore: result.credibilityScore,
      explanation: result.explanation,
      evidence: result.evidence,
      latencyMs: result.latencyMs,
    })
    .returning({ id: analyses.id });

  return NextResponse.json({ id: inserted.id, isMock });
}

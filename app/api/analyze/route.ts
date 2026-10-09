import { NextRequest, NextResponse } from 'next/server';
import { analyzeInputSchema, mlResponseSchema, MLResponse } from '@/lib/validations';
import { getOrCreateSessionId } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { generateMockResult } from '@/lib/mock';
import { db } from '@/lib/db/client';
import { analyses } from '@/lib/db/schema';
import { saveInMemory } from '@/lib/db/store';
import { spawn } from 'child_process';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 120;

function runLocalClassifier(imageUrl: string, claim: string, language: string, type: string): Promise<MLResponse> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'ml', 'predict.py');
    const pythonExe = 'python';

    const py = spawn(pythonExe, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, HF_HOME: 'E:\\.cache\\huggingface' },
    });

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    py.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    py.on('error', (err) => {
      reject(err);
    });

    py.on('close', (code) => {
      if (code !== 0 && !stdout.includes('"label"')) {
        return reject(new Error(`Python process exited with code ${code}: ${stderr}`));
      }
      try {
        const lines = stdout.trim().split('\n');
        let parsedJson = null;
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith('{') && line.endsWith('}')) {
            try {
              parsedJson = JSON.parse(line);
              break;
            } catch {
              // continue scanning
            }
          }
        }
        if (!parsedJson) {
          throw new Error('No JSON output returned from Python classifier: ' + stdout);
        }
        const validated = mlResponseSchema.parse(parsedJson);
        resolve(validated);
      } catch (err) {
        reject(err);
      }
    });

    // Stream input payload via stdin to safely handle large base64 uploads
    py.stdin.write(JSON.stringify({ imageUrl, claim, language, type: type || 'image-text' }));
    py.stdin.end();
  });
}

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
  let result: MLResponse;

  // 1. If ML_API_URL is configured, try calling it
  if (mlApiUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);

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
          type: type || 'image-text',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) throw new Error(`ML API returned ${res.status}`);
      const raw = await res.json();
      result = mlResponseSchema.parse(raw);
    } catch {
      // Fallback to local python classifier
      try {
        result = await runLocalClassifier(imageUrl, claim, language, type || 'image-text');
        isMock = false;
      } catch (localErr) {
        console.error('Local classifier failed:', localErr);
        isMock = true;
        result = generateMockResult(claim, language);
      }
    }
  } else {
    // 2. Direct execution of local python CLIP classifier
    try {
      result = await runLocalClassifier(imageUrl, claim, language, type || 'image-text');
      isMock = false;
    } catch (localErr) {
      console.error('Local classifier failed:', localErr);
      isMock = true;
      result = generateMockResult(claim, language);
    }
  }

  const recordId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // Always save to persistent local store first to ensure 100% reliability
  saveInMemory({
    id: recordId,
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
    createdAt,
    isMock,
  });

  // Try DB if Neon PostgreSQL is configured
  try {
    await db.insert(analyses).values({
      id: recordId,
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
    });
  } catch {
    // DB skipped, already saved in persistent store
  }

  return NextResponse.json({ id: recordId, isMock });
}

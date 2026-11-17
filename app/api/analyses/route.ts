import { NextRequest, NextResponse } from 'next/server';
import { getSessionId } from '@/lib/session';
import { listAnalyses } from '@/lib/db/repository';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const sessionId = getSessionId();
  const { searchParams } = new URL(req.url);
  const rows = await listAnalyses({
    sessionId: sessionId || undefined,
    search: searchParams.get('search'),
    label: searchParams.get('label'),
  });
  return NextResponse.json(rows);
}

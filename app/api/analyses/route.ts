import { NextRequest, NextResponse } from 'next/server';
import { getSessionId } from '@/lib/session';
import { db } from '@/lib/db/client';
import { analyses } from '@/lib/db/schema';
import { eq, ilike, and, desc } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const sessionId = getSessionId();
  if (!sessionId) {
    return NextResponse.json([]);
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const label = searchParams.get('label');

  const conditions = [eq(analyses.sessionId, sessionId)];
  if (search) {
    conditions.push(ilike(analyses.claim, `%${search}%`));
  }
  if (label && label !== 'all') {
    conditions.push(eq(analyses.label, label));
  }

  const rows = await db
    .select()
    .from(analyses)
    .where(and(...conditions))
    .orderBy(desc(analyses.createdAt));

  return NextResponse.json(rows);
}

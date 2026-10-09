import { NextRequest, NextResponse } from 'next/server';
import { getSessionId } from '@/lib/session';
import { db } from '@/lib/db/client';
import { analyses } from '@/lib/db/schema';
import { getAllFromMemory } from '@/lib/db/store';
import { eq, ilike, and, desc } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const sessionId = getSessionId();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const label = searchParams.get('label');

  // Try DB first if connected
  try {
    const conditions = [];
    if (sessionId) {
      conditions.push(eq(analyses.sessionId, sessionId));
    }
    if (search) {
      conditions.push(ilike(analyses.claim, `%${search}%`));
    }
    if (label && label !== 'all') {
      conditions.push(eq(analyses.label, label));
    }

    const rows = await db
      .select()
      .from(analyses)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(analyses.createdAt));

    if (rows && rows.length > 0) {
      return NextResponse.json(rows);
    }
  } catch {
    // DB skipped
  }

  // Fallback to local persistent store
  let rows = getAllFromMemory(sessionId || undefined);
  if (search) {
    rows = rows.filter((r) => r.claim.toLowerCase().includes(search.toLowerCase()));
  }
  if (label && label !== 'all') {
    rows = rows.filter((r) => r.label === label);
  }

  return NextResponse.json(rows);
}

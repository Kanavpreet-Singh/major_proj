import { NextRequest, NextResponse } from 'next/server';
import { getSessionId } from '@/lib/session';
import { db } from '@/lib/db/client';
import { analyses } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = getSessionId();
  if (!sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [row] = await db
    .select()
    .from(analyses)
    .where(and(eq(analyses.id, params.id), eq(analyses.sessionId, sessionId)));

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = getSessionId();
  if (!sessionId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [row] = await db
    .select()
    .from(analyses)
    .where(and(eq(analyses.id, params.id), eq(analyses.sessionId, sessionId)));

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.delete(analyses).where(eq(analyses.id, params.id));

  return NextResponse.json({ success: true });
}

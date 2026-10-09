import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { analyses } from '@/lib/db/schema';
import { getFromMemory, deleteFromMemory } from '@/lib/db/store';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Check persistent local store first
  const memoryRow = getFromMemory(params.id);
  if (memoryRow) {
    return NextResponse.json(memoryRow);
  }

  // Fallback to database
  try {
    const [row] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.id, params.id));

    if (row) {
      return NextResponse.json(row);
    }
  } catch {
    // Database query failed
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  deleteFromMemory(params.id);

  try {
    await db.delete(analyses).where(eq(analyses.id, params.id));
  } catch {
    // DB skipped
  }

  return NextResponse.json({ success: true });
}

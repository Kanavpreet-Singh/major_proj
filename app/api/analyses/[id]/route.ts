import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis, deleteAnalysis } from '@/lib/db/repository';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const row = params.id ? await getAnalysis(params.id) : null;
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await deleteAnalysis(params.id);
  return NextResponse.json({ success: true });
}

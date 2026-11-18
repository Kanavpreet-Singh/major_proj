import { NextRequest, NextResponse } from 'next/server';
import { getXRay } from '@/lib/db/xray-repository';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const record = params.id ? await getXRay(params.id) : null;
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(record);
}

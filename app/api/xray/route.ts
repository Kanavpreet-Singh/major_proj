import { NextResponse } from 'next/server';
import { getSessionId } from '@/lib/session';
import { listXRays } from '@/lib/db/xray-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Recent X-Ray scans for this browser session. */
export async function GET() {
  return NextResponse.json(await listXRays(getSessionId()));
}

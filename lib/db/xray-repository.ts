import fs from 'fs';
import path from 'path';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { xrays } from '@/lib/db/schema';
import type { XRayRecord, XRayResult } from '@/lib/validations';

/**
 * Article X-Ray storage: Postgres when DATABASE_URL is set, with data/xrays.json as a
 * fallback so a finished scan is never lost if the database is unreachable.
 */
const usePostgres = Boolean(process.env.DATABASE_URL);
const FILE = path.join(process.cwd(), 'data', 'xrays.json');

function readLocal(): XRayRecord[] {
  try {
    return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf-8')) : [];
  } catch {
    return [];
  }
}

function writeLocal(items: XRayRecord[]) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('[xray storage] could not write local file:', err);
  }
}

type Row = typeof xrays.$inferSelect;

function toRecord(row: Row): XRayRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    url: row.url,
    title: row.title,
    text: row.text,
    truncated: row.truncated,
    claims: row.claims as XRayRecord['claims'],
    summary: row.summary as XRayRecord['summary'],
    latencyMs: row.latencyMs,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function saveXRay(result: XRayResult, sessionId: string): Promise<string> {
  const { kind: _kind, ...rest } = result; // eslint-disable-line @typescript-eslint/no-unused-vars
  const record: XRayRecord = { ...rest, id: crypto.randomUUID(), sessionId, createdAt: new Date().toISOString() };
  if (usePostgres) {
    try {
      await db.insert(xrays).values({ ...record, createdAt: new Date(record.createdAt) });
      return record.id;
    } catch (err) {
      console.error('[xray storage] Postgres insert failed, saving locally instead:', err);
    }
  }
  writeLocal([record, ...readLocal()]);
  return record.id;
}

export async function getXRay(id: string): Promise<XRayRecord | null> {
  if (usePostgres) {
    try {
      const [row] = await db.select().from(xrays).where(eq(xrays.id, id));
      if (row) return toRecord(row);
    } catch (err) {
      console.error('[xray storage] Postgres read failed:', err);
    }
  }
  return readLocal().find((r) => r.id === id) ?? null;
}

/** Recent scans for a session, without the article text and debates (kept small for lists). */
export async function listXRays(sessionId: string | null, limit = 12) {
  let items: XRayRecord[] = readLocal().filter((r) => !sessionId || r.sessionId === sessionId);
  if (usePostgres) {
    try {
      const rows = await db
        .select()
        .from(xrays)
        .where(sessionId ? eq(xrays.sessionId, sessionId) : undefined)
        .orderBy(desc(xrays.createdAt))
        .limit(limit);
      const ids = new Set(rows.map((r) => r.id));
      items = [...rows.map(toRecord), ...items.filter((r) => !ids.has(r.id))];
    } catch (err) {
      console.error('[xray storage] Postgres list failed:', err);
    }
  }
  return items
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map(({ id, title, url, summary, createdAt }) => ({ id, title, url, summary, createdAt }));
}

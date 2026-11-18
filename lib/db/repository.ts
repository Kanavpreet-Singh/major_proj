import { and, desc, eq, ilike } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { analyses } from '@/lib/db/schema';
import { deleteFromMemory, getAllFromMemory, getFromMemory, saveInMemory } from '@/lib/db/store';
import type { AnalysisRecord } from '@/lib/types';

/**
 * Analysis storage. Postgres (Neon) is the source of truth when DATABASE_URL is set.
 * The local JSON file (data/analyses.json) is used only when Postgres is not configured
 * or a write fails, so a result is never lost; failures are logged, not swallowed.
 */
const usePostgres = Boolean(process.env.DATABASE_URL);

type Row = typeof analyses.$inferSelect;

function toRecord(row: Row): AnalysisRecord {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    evidence: row.evidence as AnalysisRecord['evidence'],
    verdictMode: row.verdictMode ?? undefined,
    labelProbs: (row.labelProbs as AnalysisRecord['labelProbs']) ?? undefined,
    debate: (row.debate as AnalysisRecord['debate']) ?? null,
  } as AnalysisRecord;
}

export async function saveAnalysis(record: AnalysisRecord): Promise<'postgres' | 'local'> {
  if (usePostgres) {
    try {
      await db.insert(analyses).values({
        ...record,
        createdAt: new Date(record.createdAt),
        verdictMode: record.verdictMode ?? null,
        labelProbs: record.labelProbs ?? null,
        debate: record.debate ?? null,
      });
      return 'postgres';
    } catch (err) {
      console.error('[storage] Postgres insert failed, saving to local JSON instead:', err);
    }
  }
  saveInMemory(record);
  return 'local';
}

export async function getAnalysis(id: string): Promise<AnalysisRecord | null> {
  if (usePostgres) {
    try {
      const [row] = await db.select().from(analyses).where(eq(analyses.id, id));
      if (row) return toRecord(row);
    } catch (err) {
      console.error('[storage] Postgres read failed:', err);
    }
  }
  return getFromMemory(id);
}

export async function listAnalyses(opts: {
  sessionId?: string;
  search?: string | null;
  label?: string | null;
}): Promise<AnalysisRecord[]> {
  const { sessionId, search, label } = opts;

  let local = getAllFromMemory(sessionId);
  if (search) local = local.filter((r) => r.claim.toLowerCase().includes(search.toLowerCase()));
  if (label && label !== 'all') local = local.filter((r) => r.label === label);

  if (!usePostgres) return local;

  try {
    const conditions = [];
    if (sessionId) conditions.push(eq(analyses.sessionId, sessionId));
    if (search) conditions.push(ilike(analyses.claim, `%${search}%`));
    if (label && label !== 'all') conditions.push(eq(analyses.label, label));
    const rows = await db
      .select()
      .from(analyses)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(analyses.createdAt));

    // Include any records that fell back to local storage during a Postgres outage
    const ids = new Set(rows.map((r) => r.id));
    return [...rows.map(toRecord), ...local.filter((r) => !ids.has(r.id))].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    console.error('[storage] Postgres list failed, using local JSON:', err);
    return local;
  }
}

export async function deleteAnalysis(id: string): Promise<void> {
  deleteFromMemory(id);
  if (usePostgres) {
    try {
      await db.delete(analyses).where(eq(analyses.id, id));
    } catch (err) {
      console.error('[storage] Postgres delete failed:', err);
    }
  }
}

/** Builds and saves the stored record for a finished analysis; returns its id. */
export async function saveResult(
  input: { imageUrl: string; claim: string },
  sessionId: string,
  result: import('@/lib/validations').MLResponse
): Promise<string> {
  const id = crypto.randomUUID();
  await saveAnalysis({
    id,
    sessionId,
    imageUrl: input.imageUrl,
    claim: input.claim,
    language: result.language,
    label: result.label,
    confidence: result.confidence,
    clipScore: result.clipScore,
    evidenceScore: result.evidenceScore,
    credibilityScore: result.credibilityScore,
    explanation: result.explanation,
    evidence: result.evidence,
    latencyMs: result.latencyMs,
    createdAt: new Date().toISOString(),
    isMock: false,
    verdictMode: result.verdictMode,
    labelProbs: result.labelProbs,
    debate: result.debate ?? null,
  });
  return id;
}

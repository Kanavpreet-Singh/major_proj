// Creates the `analyses` table in Postgres (matching lib/db/schema.ts) and copies
// any analyses saved in data/analyses.json into it. Safe to run more than once.
//   Usage: npm run db:init
import { neon } from '@neondatabase/serverless';
import fs from 'fs';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (add it to .env)');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS analyses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id text NOT NULL,
    image_url text NOT NULL,
    claim text NOT NULL,
    language text NOT NULL,
    label text NOT NULL,
    confidence real NOT NULL,
    clip_score real NOT NULL,
    evidence_score real NOT NULL,
    credibility_score real NOT NULL,
    explanation text NOT NULL,
    evidence jsonb NOT NULL,
    latency_ms integer NOT NULL,
    verdict_mode text,
    label_probs jsonb,
    debate jsonb,
    created_at timestamp DEFAULT now() NOT NULL
  )`;
await sql`ALTER TABLE analyses ADD COLUMN IF NOT EXISTS verdict_mode text`;
await sql`ALTER TABLE analyses ADD COLUMN IF NOT EXISTS label_probs jsonb`;
await sql`ALTER TABLE analyses ADD COLUMN IF NOT EXISTS debate jsonb`;
await sql`CREATE INDEX IF NOT EXISTS idx_analyses_session_id ON analyses (session_id)`;
console.log('Table "analyses" is ready.');

const file = 'data/analyses.json';
const local = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
let inserted = 0;
for (const r of local) {
  const res = await sql`
    INSERT INTO analyses (id, session_id, image_url, claim, language, label, confidence, clip_score,
      evidence_score, credibility_score, explanation, evidence, latency_ms,
      verdict_mode, label_probs, debate, created_at)
    VALUES (${r.id}, ${r.sessionId}, ${r.imageUrl}, ${r.claim}, ${r.language}, ${r.label}, ${r.confidence},
      ${r.clipScore}, ${r.evidenceScore}, ${r.credibilityScore}, ${r.explanation},
      ${JSON.stringify(r.evidence ?? [])}::jsonb, ${r.latencyMs}, ${r.verdictMode ?? null},
      ${r.labelProbs ? JSON.stringify(r.labelProbs) : null}::jsonb,
      ${r.debate ? JSON.stringify(r.debate) : null}::jsonb, ${r.createdAt})
    ON CONFLICT (id) DO NOTHING
    RETURNING id`;
  inserted += res.length;
}
const [{ count }] = await sql`SELECT count(*)::int AS count FROM analyses`;
console.log(`Copied ${inserted} of ${local.length} local analyses. Postgres now holds ${count}.`);

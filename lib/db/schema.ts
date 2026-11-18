import { pgTable, uuid, text, real, integer, timestamp, jsonb, index, boolean } from 'drizzle-orm/pg-core';

export const analyses = pgTable(
  'analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: text('session_id').notNull(),
    imageUrl: text('image_url').notNull(),
    claim: text('claim').notNull(),
    language: text('language').notNull(),
    label: text('label').notNull(),
    confidence: real('confidence').notNull(),
    clipScore: real('clip_score').notNull(),
    evidenceScore: real('evidence_score').notNull(),
    credibilityScore: real('credibility_score').notNull(),
    explanation: text('explanation').notNull(),
    evidence: jsonb('evidence').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    // Multi-agent debate output (text / PDF analyses only)
    verdictMode: text('verdict_mode'),
    labelProbs: jsonb('label_probs'),
    debate: jsonb('debate'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index('idx_analyses_session_id').on(table.sessionId),
  })
);

export type Analysis = typeof analyses.$inferSelect;

export const xrays = pgTable(
  'xrays',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: text('session_id').notNull(),
    url: text('url').notNull(),
    title: text('title').notNull(),
    text: text('text').notNull(),
    truncated: boolean('truncated').notNull().default(false),
    claims: jsonb('claims').notNull(),
    summary: jsonb('summary').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index('idx_xrays_session_id').on(table.sessionId),
  })
);


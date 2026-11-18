import { z } from 'zod';

export const analyzeInputSchema = z.object({
  imageUrl: z.string().min(1),
  claim: z.string().min(1).max(2500),
  language: z.enum(['auto', 'en', 'hi', 'ur', 'zh']).default('auto'),
  type: z.enum(['text', 'pdf', 'image-text']).optional(),
});

export type AnalyzeInput = z.infer<typeof analyzeInputSchema>;

export const credibilitySchema = z.enum(['High', 'Medium', 'Low']);
export const stanceSchema = z.enum(['Supports', 'Refutes', 'Neutral']);
export const verdictSchema = z.enum(['True', 'False', 'Misleading', 'Unverifiable']);

export const evidenceItemSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  domain: z.string(),
  snippet: z.string(),
  credibility: credibilitySchema,
  stance: stanceSchema,
});

export const mlResponseSchema = z.object({
  label: verdictSchema,
  confidence: z.number().min(0).max(1),
  clipScore: z.number().min(0).max(1),
  evidenceScore: z.number().min(0).max(1),
  credibilityScore: z.number().min(0).max(1),
  explanation: z.string(),
  language: z.string(),
  latencyMs: z.number(),
  evidence: z.array(evidenceItemSchema),
  // Present for text/PDF analyses decided by the multi-agent debate
  verdictMode: z.string().optional(),
  labelProbs: z
    .object({ supported: z.number(), refuted: z.number(), insufficient: z.number() })
    .optional(),
  debate: z.array(z.any()).nullable().optional(),
});

export type MLResponse = z.infer<typeof mlResponseSchema>;

// ── Article X-Ray ──────────────────────────────────────────────

export const xrayInputSchema = z
  .object({
    url: z.string().url().optional(),
    text: z.string().max(20000).optional(),
  })
  .refine((v) => Boolean(v.url) !== Boolean(v.text?.trim()), {
    message: 'Provide either an article URL or pasted text.',
  });

const probsSchema = z.object({ supported: z.number(), refuted: z.number(), insufficient: z.number() });

export const xrayClaimSchema = z.object({
  index: z.number(),
  quote: z.string(),
  claim: z.string(),
  start: z.number(),
  end: z.number(),
  checkworthiness: z.number(),
  category: z.string(),
  label: z.enum(['supported', 'not_supported', 'insufficient']).optional(),
  probs: probsSchema.optional(),
  explanation: z.string().optional(),
  method: z.string().optional(),
  debate: z.any().nullable().optional(),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).optional(),
});

export const xraySummarySchema = z.object({
  total: z.number(),
  supported: z.number(),
  not_supported: z.number(),
  insufficient: z.number(),
  truth_score: z.number().nullable(),
});

export const xrayResultSchema = z.object({
  kind: z.literal('xray'),
  title: z.string(),
  url: z.string(),
  text: z.string(),
  truncated: z.boolean(),
  claims: z.array(xrayClaimSchema),
  summary: xraySummarySchema,
  latencyMs: z.number(),
});

export type XRayClaim = z.infer<typeof xrayClaimSchema>;
export type XRaySummary = z.infer<typeof xraySummarySchema>;
export type XRayResult = z.infer<typeof xrayResultSchema>;
export type XRayRecord = Omit<XRayResult, 'kind'> & { id: string; sessionId: string; createdAt: string };

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
});

export type MLResponse = z.infer<typeof mlResponseSchema>;

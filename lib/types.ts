export type Verdict = 'True' | 'False' | 'Misleading' | 'Unverifiable';

export type Credibility = 'High' | 'Medium' | 'Low';

export type Stance = 'Supports' | 'Refutes' | 'Neutral';

export interface EvidenceItem {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  credibility: Credibility;
  stance: Stance;
}

export interface AnalysisResult {
  label: Verdict;
  confidence: number;
  clipScore: number;
  evidenceScore: number;
  credibilityScore: number;
  explanation: string;
  language: string;
  latencyMs: number;
  evidence: EvidenceItem[];
  isMock?: boolean;
}

export interface AnalysisRecord {
  id: string;
  sessionId: string;
  imageUrl: string;
  claim: string;
  language: string;
  label: Verdict;
  confidence: number;
  clipScore: number;
  evidenceScore: number;
  credibilityScore: number;
  explanation: string;
  evidence: EvidenceItem[];
  latencyMs: number;
  createdAt: string;
  isMock?: boolean;
}

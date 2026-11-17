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

export interface LabelProbs {
  supported: number;
  refuted: number;
  insufficient: number;
}

export interface DebateCitation {
  id: string;
  quote: string;
  verified: boolean;
}

export interface DebateArgument {
  role: 'defender' | 'prosecutor';
  round: number;
  argument: string;
  citations: DebateCitation[];
  conceded: boolean;
}

export interface DebateEvidence {
  id: string;
  source_name: string;
  source_url: string;
  passage: string;
  credibility: number;
}

export interface SubclaimDebate {
  subclaim: string;
  verdict: 'supported' | 'not_supported' | 'insufficient';
  probs: LabelProbs;
  abstained: boolean;
  judge: {
    p_supported: number;
    p_refuted: number;
    p_insufficient: number;
    winner: 'defender' | 'prosecutor' | 'tie';
    decisive_evidence: string[];
    reasoning: string;
  };
  arguments: DebateArgument[];
  evidence: DebateEvidence[];
  grounding: { defender: number | null; prosecutor: number | null };
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
  verdictMode?: string;
  labelProbs?: LabelProbs;
  debate?: SubclaimDebate[] | null;
}

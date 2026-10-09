import type { AnalysisResult, EvidenceItem } from './types';

const sampleEvidence: EvidenceItem[] = [
  {
    title: 'Reuters Fact Check: Image shows flooded street in 2018, not recent event',
    url: 'https://www.reuters.com/fact-check/mock-1',
    domain: 'reuters.com',
    snippet:
      'A reverse image search reveals the photograph was originally published in September 2018 during flooding in Kerala, India. It does not depict the claimed recent event.',
    credibility: 'High',
    stance: 'Refutes',
  },
  {
    title: 'AP News: Doctored photo circulates online with false caption',
    url: 'https://apnews.com/article/mock-2',
    domain: 'apnews.com',
    snippet:
      'The Associated Press confirmed the image has been digitally altered. Metadata analysis shows signs of manipulation in the foreground elements.',
    credibility: 'High',
    stance: 'Refutes',
  },
  {
    title: 'Snopes: Viral image miscaptioned — here is what actually happened',
    url: 'https://www.snopes.com/fact-check/mock-3',
    domain: 'snopes.com',
    snippet:
      'The viral post misidentifies the location and date. Snopes reached out to the original photographer who confirmed the image was taken in a different city.',
    credibility: 'High',
    stance: 'Refutes',
  },
  {
    title: 'BBC News: What we know about the viral photograph',
    url: 'https://www.bbc.com/news/mock-4',
    domain: 'bbc.com',
    snippet:
      'BBC verified that the building in the background matches a known landmark, confirming the image was taken in a different country than claimed.',
    credibility: 'High',
    stance: 'Neutral',
  },
];

export function generateMockResult(claim: string, language: string): AnalysisResult {
  const claimLower = claim.toLowerCase();
  let label: AnalysisResult['label'] = 'False';
  let confidence = 0.87;
  let clipScore = 0.31;
  let evidenceScore = 0.82;
  let credibilityScore = 0.9;

  if (claimLower.includes('real') || claimLower.includes('true') || claimLower.includes('confirmed')) {
    label = 'Misleading';
    confidence = 0.64;
    clipScore = 0.58;
    evidenceScore = 0.45;
    credibilityScore = 0.72;
  } else if (claimLower.includes('climate') || claimLower.includes('science')) {
    label = 'True';
    confidence = 0.91;
    clipScore = 0.78;
    evidenceScore = 0.88;
    credibilityScore = 0.85;
  } else if (claimLower.length < 20) {
    label = 'Unverifiable';
    confidence = 0.42;
    clipScore = 0.5;
    evidenceScore = 0.3;
    credibilityScore = 0.4;
  }

  const explanations: Record<string, string> = {
    True: 'The uploaded image is consistent with the written claim, and multiple high-credibility sources corroborate the described event. The CLIP image-text consistency score is high (0.78), indicating the image visually matches the claim. Retrieved evidence from Reuters, AP, and BBC all support the claim with no contradicting sources found.',
    False: 'The image-text consistency score is low (0.31), meaning the image does not visually align with the written claim. A reverse image search shows the photo predates the claimed event. Three high-credibility fact-checking sources (Reuters, AP, Snopes) all explicitly refute the claim, and no supporting evidence was found in trusted outlets.',
    Misleading: 'While the image is partially consistent with the claim (CLIP score 0.58), the evidence is mixed. The core event did occur, but key details such as location, timing, and cause are misrepresented. One source partially supports the narrative while two others note significant inaccuracies. The system labels this as misleading rather than outright false.',
    Unverifiable: 'Not enough reliable evidence was found to make a determination. The claim is vague or refers to a niche topic not covered by trusted fact-checking sources. The evidence stance score is low (0.30) and no high-credibility source was retrieved. The system abstains rather than guessing.',
  };

  return {
    label,
    confidence,
    clipScore,
    evidenceScore,
    credibilityScore,
    explanation: explanations[label],
    language: language === 'auto' ? 'en' : language,
    latencyMs: 3800,
    evidence: label === 'Unverifiable' ? sampleEvidence.slice(0, 2) : sampleEvidence,
    isMock: true,
  };
}

"""
Verdict Prediction Agent - Evidence aggregation and verdict synthesis
"""

from typing import List, Dict, Any
from dataclasses import dataclass, asdict
from loguru import logger
import yaml
import os
import json
import re
import sys
sys.path.append('..')
from src.utils.llm_interface import LLMInterface


@dataclass
class SubclaimVerdict:
    """Verdict for a single subclaim"""
    supports:str
    claim:str



@dataclass
class VerdictResult:
    """Final verdict result"""
    subclaim_verdicts: List[SubclaimVerdict]
    final_verdict: str
    explanation: str


class VerdictPredictionAgent:
    """
    Agent 4: Verdict Prediction

    Aggregates evidence using weighted voting:
    - HIGH credibility: 1.0 weight
    - MEDIUM credibility: 0.6 weight
    - LOW credibility: 0.3 weight

    Decision thresholds:
    - Score > 0.7 → SUPPORTED
    - Score < 0.3 → NOT_SUPPORTED
    """

    def __init__(self, config: Dict[str, Any] = None, llm_interface=None):
        """
        Initialize Verdict Prediction Agent.

        Args:
            config: Configuration dictionary
            llm_interface: Optional LLM for explanation generation
        """
        self.config = config or {}
        self.llm = llm_interface
        self.prompt_template = None

        if self.llm and isinstance(self.llm, LLMInterface):
            try:
                prompt_path = os.path.join(os.path.dirname(__file__), '../../config/agent_prompt.yaml')
                with open(prompt_path, 'r') as f:
                    prompts = yaml.safe_load(f)
                    self.prompt_template = prompts.get('verdict_prediction', {})
            except Exception as e:
                logger.warning(f"Could not load agent_prompt.yaml for verdict prediction: {e}")


        logger.info("Verdict Prediction Agent initialized")

    def process(
        self,
        evideneces: List[Any]
    ) -> VerdictResult:
        """
        Predict verdict based on evidence.

        Args:
            original_claim: Original claim text
            evidence_results: List of EvidenceResult objects

        Returns:
            VerdictResult with final verdict and explanation
        """

        # Process each subclaim
        subclaim_verdicts = []
        for evidence_result in evideneces:
            logger.debug(f"Evidence result: {evidence_result}")
            verdict = self._predict_subclaim_verdict(evidence_result.subclaim_text, evidence_result.evidence)
            subclaim_verdicts.append(verdict)

        # Aggregate to final verdict
        final_verdict_bool = self._aggregate_verdicts(subclaim_verdicts)
        final_verdict = "SUPPORTED" if final_verdict_bool else "NOT_SUPPORTED"
        logger.debug(f"subclaim verdicts: {subclaim_verdicts}")
        logger.debug(f"Final verdict: {final_verdict}")

        # Synthesize clear overall explanation
        explanations = [sv.claim for sv in subclaim_verdicts if sv.claim]
        if explanations:
            explanation = " ".join(explanations)
        else:
            explanation = f"Cross-referenced claim with {len(evideneces)} subclaim queries against verified sources. Final verdict: {final_verdict}."

        result = VerdictResult(
            subclaim_verdicts=subclaim_verdicts,
            final_verdict=final_verdict,
            explanation=explanation,
        )

        logger.info(f"Final result is : {result}")
        return result

    def _predict_subclaim_verdict(self, original_claim: str, evidence_result: List[Any]) -> SubclaimVerdict:
        """Predict verdict for a single subclaim using LLM with heuristic fallback"""
        cell_parts = []
        for ev in evidence_result:
            source_name = getattr(ev, 'source_name', getattr(ev, 'source_url', 'Source'))
            passage = getattr(ev, 'passage', '')
            cell_parts.append(f"- Source: {source_name}\n  Passage: {passage}")

        cell = "\n".join(cell_parts)

        # 1. Try LLM evaluation if available
        if self.llm and self.prompt_template and cell.strip():
            try:
                prompt = self.prompt_template.format(claim=str(original_claim), cell=cell)
                response = self.llm.generate(prompt=prompt)
                logger.debug(f"Verdict agent prompt response: {response}")

                clean_resp = response.strip()
                if "```json" in clean_resp:
                    clean_resp = clean_resp.split("```json")[1].split("```")[0].strip()
                elif "```" in clean_resp:
                    clean_resp = clean_resp.split("```")[1].split("```")[0].strip()

                data = json.loads(clean_resp)
                return SubclaimVerdict(
                    supports=data.get('label', 'supported'),
                    claim=data.get('explanation', f"Evidence from retrieved sources supports '{original_claim}'."),
                )
            except Exception as e:
                logger.warning(f"LLM verdict prediction failed, falling back to evidence heuristics: {e}")

        # 2. Heuristic evidence synthesis fallback
        claim_str = str(original_claim or '')
        if not evidence_result or not cell.strip():
            return SubclaimVerdict(
                supports="not_supported",
                claim=f"No corroborating evidence could be verified for '{claim_str[:60]}...'.",
            )

        # Check keyword presence in evidence
        claim_words = set(re.findall(r'\w+', claim_str.lower())) - {'is', 'the', 'a', 'an', 'in', 'of', 'for', 'to', 'and', 'that', 'with'}
        cell_words = set(re.findall(r'\w+', cell.lower()))
        overlap_ratio = len(claim_words & cell_words) / max(1, len(claim_words))

        first_ev = evidence_result[0]
        first_src = getattr(first_ev, 'source_name', 'Primary source')
        first_pass = getattr(first_ev, 'passage', '')[:180]

        if overlap_ratio >= 0.5:
            return SubclaimVerdict(
                supports="supported",
                claim=f"Corroborated by {first_src}: \"{first_pass}...\"",
            )
        else:
            return SubclaimVerdict(
                supports="not_supported",
                claim=f"Sources did not provide sufficient direct confirmation for '{claim_str[:60]}...'.",
            )

    def _aggregate_verdicts(
        self,
        subclaim_verdicts: List[SubclaimVerdict]
    ) -> bool:
        """Aggregate verdicts to final verdict"""
        for claim in subclaim_verdicts:
            if (claim.supports=="not_supported"):
                return False
        return True

    def to_dict(self, result: VerdictResult) -> Dict[str, Any]:
        """Convert result to dictionary"""
        return asdict(result)
    
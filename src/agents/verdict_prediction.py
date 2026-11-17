"""
Verdict Prediction Agent - Evidence aggregation and verdict synthesis

Modes (config: verdict_prediction.mode):
  - "debate": Prosecutor vs Defender, decided by a Judge (see debate.py). Default.
  - "single": one LLM call per subclaim reads the evidence and decides. Kept as the
              baseline for comparing against debate.
  - Without an LLM, both modes fall back to a keyword-overlap heuristic.

Every subclaim verdict carries probabilities over {supported, refuted, insufficient},
which are combined into claim-level probabilities (see _aggregate_probs).
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict, field
from loguru import logger
import yaml
import os
import re
import sys
sys.path.append('..')
from src.utils.llm_interface import LLMInterface
from src.agents.debate import DebateAgent, parse_json_response


@dataclass
class SubclaimVerdict:
    """Verdict for a single subclaim"""
    supports: str                 # "supported" | "not_supported" | "insufficient"
    claim: str                    # explanation text (field name kept for compatibility)
    subclaim: str = ""
    p_supported: float = 0.0
    p_refuted: float = 0.0
    p_insufficient: float = 0.0
    method: str = "heuristic"     # "debate" | "single" | "heuristic"
    debate: Optional[Dict[str, Any]] = None


@dataclass
class VerdictResult:
    """Final verdict result"""
    subclaim_verdicts: List[SubclaimVerdict]
    final_verdict: str            # "SUPPORTED" | "NOT_SUPPORTED" | "NOT_ENOUGH_INFO"
    explanation: str
    label_probs: Dict[str, float] = field(default_factory=dict)
    overall_confidence: float = 0.0
    mode: str = "heuristic"
    metadata: Dict[str, Any] = field(default_factory=dict)


class VerdictPredictionAgent:
    """
    Agent 4: Verdict Prediction

    Decides each subclaim, then combines them: the claim is supported only if
    every subclaim is supported.
    """

    def __init__(self, config: Dict[str, Any] = None, llm_interface=None):
        self.config = config or {}
        self.llm = llm_interface
        self.mode = str(self.config.get('mode', 'debate')).lower()
        self.prompt_template = None
        self.debate_agent = None

        if self.llm and isinstance(self.llm, LLMInterface):
            try:
                prompt_path = os.path.join(os.path.dirname(__file__), '../../config/agent_prompt.yaml')
                with open(prompt_path, 'r', encoding='utf-8') as f:
                    prompts = yaml.safe_load(f)
                self.prompt_template = prompts.get('verdict_prediction')
                if self.mode == 'debate':
                    self.debate_agent = DebateAgent(self.llm, prompts, self.config.get('debate', {}))
            except Exception as e:
                logger.warning(f"Could not set up verdict prompts ({self.mode} mode): {e}")

        logger.info(f"Verdict Prediction Agent initialized (mode={self.mode}, "
                    f"llm={'yes' if self.llm else 'no'})")

    def process(self, evideneces: List[Any], claim: Optional[str] = None) -> VerdictResult:
        """
        Predict verdict based on evidence.

        Args:
            evideneces: List of EvidenceResult objects, one per subclaim
            claim: Original full claim, given to the debaters as context

        Returns:
            VerdictResult with final verdict, probabilities and explanation
        """
        subclaim_verdicts = []
        for evidence_result in evideneces:
            subclaim = evidence_result.subclaim_text
            verdict = self._predict_subclaim_verdict(claim or subclaim, subclaim, evidence_result.evidence)
            subclaim_verdicts.append(verdict)

        probs = self._aggregate_probs(subclaim_verdicts)
        final_verdict = max(probs, key=probs.get)
        final_verdict = {
            'supported': 'SUPPORTED',
            'refuted': 'NOT_SUPPORTED',
            'insufficient': 'NOT_ENOUGH_INFO',
        }[final_verdict]

        explanations = [sv.claim for sv in subclaim_verdicts if sv.claim]
        explanation = " ".join(explanations) if explanations else (
            f"Cross-referenced claim with {len(evideneces)} subclaim queries. Final verdict: {final_verdict}."
        )

        methods = {sv.method for sv in subclaim_verdicts}
        result = VerdictResult(
            subclaim_verdicts=subclaim_verdicts,
            final_verdict=final_verdict,
            explanation=explanation,
            label_probs=probs,
            overall_confidence=max(probs.values()) if probs else 0.0,
            mode=methods.pop() if len(methods) == 1 else 'mixed',
            metadata={
                'llm_calls': sum((sv.debate or {}).get('llm_calls', 0) for sv in subclaim_verdicts),
                'abstained_subclaims': sum(sv.supports == 'insufficient' for sv in subclaim_verdicts),
            },
        )
        logger.info(f"Verdict: {final_verdict} probs={probs} mode={result.mode}")
        return result

    # ------------------------------------------------------------------ per subclaim

    def _predict_subclaim_verdict(self, original_claim: str, subclaim: str, evidence_result: List[Any]) -> SubclaimVerdict:
        """Decide one subclaim: debate, single LLM call, or heuristic fallback."""
        if self.debate_agent:
            try:
                d = self.debate_agent.debate(original_claim, subclaim, evidence_result)
                j = d.judge
                return SubclaimVerdict(
                    supports=d.label,
                    claim=j.reasoning or f"Debate outcome: {d.label}.",
                    subclaim=subclaim,
                    p_supported=j.p_supported,
                    p_refuted=j.p_refuted,
                    p_insufficient=j.p_insufficient,
                    method='debate',
                    debate=d.to_dict(),
                )
            except Exception as e:
                logger.warning(f"Debate failed, falling back to single verdict: {e}")

        cell = "\n".join(
            f"- Source: {getattr(ev, 'source_name', getattr(ev, 'source_url', 'Source'))}\n"
            f"  Passage: {getattr(ev, 'passage', '')}"
            for ev in evidence_result
        )

        if self.llm and self.prompt_template and cell.strip():
            try:
                prompt = self.prompt_template.format(claim=str(subclaim), cell=cell)
                data = parse_json_response(self.llm.generate(prompt=prompt))
                label = 'supported' if str(data.get('label', '')).lower() == 'supported' else 'not_supported'
                try:
                    conf = min(1.0, max(0.0, float(data.get('confidence', 0.5))))
                except (TypeError, ValueError):
                    conf = 0.5
                p_sup = conf if label == 'supported' else 1.0 - conf
                return SubclaimVerdict(
                    supports=label,
                    claim=data.get('explanation', ''),
                    subclaim=subclaim,
                    p_supported=round(p_sup, 4),
                    p_refuted=round(1.0 - p_sup, 4),
                    p_insufficient=0.0,
                    method='single',
                )
            except Exception as e:
                logger.warning(f"LLM verdict prediction failed, falling back to evidence heuristics: {e}")

        return self._heuristic_verdict(subclaim, evidence_result, cell)

    def _heuristic_verdict(self, subclaim: str, evidence_result: List[Any], cell: str) -> SubclaimVerdict:
        """Keyword overlap between subclaim and evidence. Used only when no LLM is available."""
        claim_str = str(subclaim or '')
        if not evidence_result or not cell.strip():
            return SubclaimVerdict(
                supports="not_supported",
                claim=f"No corroborating evidence could be verified for '{claim_str[:60]}...'.",
                subclaim=subclaim, p_supported=0.0, p_refuted=0.0, p_insufficient=1.0,
            )

        stop = {'is', 'the', 'a', 'an', 'in', 'of', 'for', 'to', 'and', 'that', 'with'}
        claim_words = set(re.findall(r'\w+', claim_str.lower())) - stop
        cell_words = set(re.findall(r'\w+', cell.lower()))
        overlap = len(claim_words & cell_words) / max(1, len(claim_words))

        first = evidence_result[0]
        src = getattr(first, 'source_name', 'Primary source')
        passage = getattr(first, 'passage', '')[:180]
        supported = overlap >= 0.5
        return SubclaimVerdict(
            supports="supported" if supported else "not_supported",
            claim=(f"Corroborated by {src}: \"{passage}...\"" if supported
                   else f"Sources did not provide sufficient direct confirmation for '{claim_str[:60]}...'."),
            subclaim=subclaim,
            p_supported=round(overlap, 4),
            p_refuted=round(1.0 - overlap, 4),
            p_insufficient=0.0,
        )

    # ------------------------------------------------------------------ aggregation

    @staticmethod
    def _aggregate_probs(subclaim_verdicts: List[SubclaimVerdict]) -> Dict[str, float]:
        """
        Combine subclaim probabilities, treating subclaims as independent:

            P(supported)    = prod_i ps_i          (every subclaim must hold)
            P(refuted)      = 1 - prod_i (1 - pr_i) (any one false detail refutes the claim)
            P(insufficient) = 1 - P(supported) - P(refuted)

        Since ps_i <= 1 - pr_i for every i, P(supported) + P(refuted) <= 1, so all
        three are valid probabilities.
        """
        if not subclaim_verdicts:
            return {'supported': 0.0, 'refuted': 0.0, 'insufficient': 1.0}
        p_s, p_not_r = 1.0, 1.0
        for sv in subclaim_verdicts:
            p_s *= sv.p_supported
            p_not_r *= (1.0 - sv.p_refuted)
        p_r = 1.0 - p_not_r
        p_n = max(0.0, 1.0 - p_s - p_r)
        return {'supported': round(p_s, 4), 'refuted': round(p_r, 4), 'insufficient': round(p_n, 4)}

    def to_dict(self, result: VerdictResult) -> Dict[str, Any]:
        """Convert result to dictionary"""
        return asdict(result)

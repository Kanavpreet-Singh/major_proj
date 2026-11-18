"""
Orchestrator - Coordinates all 6 agents in the fact-checking pipeline
"""

from typing import Dict, Any, Optional
import yaml
from pathlib import Path
from loguru import logger
import sys
import time
import urllib.parse
from dataclasses import asdict

# Import all agents
from src.agents.input_ingestion import InputIngestionAgent
from src.agents.query_generation import QueryGenerationAgent
from src.agents.evidence_seeking import EvidenceSeekingAgent
from src.agents.verdict_prediction import VerdictPredictionAgent
from src.agents.explainable_ai import ExplainableAIAgent
from src.agents.reinforcement_learning import ReinforcementLearningAgent
from src.utils.llm_interface import LLMInterface
from src.utils.events import as_emitter


class FactCheckingOrchestrator:
    """
    Main orchestrator for the multi-agent fact-checking pipeline.

    Workflow:
    1. Input Ingestion → Decompose claim
    2. Query Generation → Create search queries
    3. Evidence Seeking → Retrieve and validate evidence
    4. Verdict Prediction → Aggregate evidence and decide
    5. Explainable AI → Generate explanations
    6. Reinforcement Learning → Track performance
    """

    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize orchestrator with all agents.

        Args:
            config_path: Path to agent_config.yaml
        """
        # Load configuration
        self.config = self._load_config(config_path)

        # Initialize LLM interface
        try:
            self.llm = LLMInterface()
            logger.info("LLM interface initialized successfully")
        except Exception as e:
            logger.warning(f"LLM initialization failed: {e}. Using fallback mode.")
            self.llm = None

        # Initialize all agents
        logger.info("Initializing agents...")

        self.input_ingestion = InputIngestionAgent(
            config=self.config.get('input_ingestion', {}),
            llm_interface=self.llm
        )

        self.query_generation = QueryGenerationAgent(
            config=self.config.get('query_generation', {}),
            llm_interface=self.llm
        )

        self.evidence_seeking = EvidenceSeekingAgent(
            config=self.config.get('evidence_seeking', {}),
            llm_interface=self.llm
        )

        self.verdict_prediction = VerdictPredictionAgent(
            config=self.config.get('verdict_prediction', {}),
            llm_interface=self.llm
        )

        self.explainable_ai = ExplainableAIAgent(
            config=self.config.get('explainable_ai', {})
        )

        self.reinforcement_learning = ReinforcementLearningAgent(
            config=self.config.get('reinforcement_learning', {})
        )

        logger.info("✓ All agents initialized successfully")

    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Load agent configuration from YAML"""
        if not config_path:
            # Try to find config file
            possible_paths = [
                Path("config/agent_config.yaml"),
                Path("../config/agent_config.yaml"),
                Path("../../config/agent_config.yaml"),
            ]

            for path in possible_paths:
                if path.exists():
                    config_path = str(path)
                    break

        if config_path and Path(config_path).exists():
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
                logger.info(f"Loaded configuration from {config_path}")
                return config
        else:
            logger.warning("Configuration file not found, using defaults")
            return {}

    def verify_claim(
        self,
        claim: str,
        ground_truth: Optional[str] = None,
        enable_xai: bool = True,
        enable_rl: bool = True,
        on_event=None,
    ) -> Dict[str, Any]:
        """
        Verify a factual claim end-to-end.

        Args:
            claim: Natural language claim to verify
            ground_truth: Optional ground truth label for evaluation
            enable_xai: Enable Explainable AI agent
            enable_rl: Enable Reinforcement Learning agent
            on_event: Optional callback receiving progress events (for live streaming)

        Returns:
            Complete results dictionary with all agent outputs
        """
        emit = as_emitter(on_event)
        logger.info("="*80)
        logger.info(f"VERIFYING CLAIM: {claim}")
        logger.info("="*80)

        results = {
            'claim': claim,
            'ground_truth': ground_truth
        }

        try:
            # AGENT 1: Input Ingestion
            logger.info("\n[1/6] Input Ingestion Agent - Decomposing claim...")
            emit("stage", stage="decompose", status="start")
            ingestion_result = self.input_ingestion.process(claim)
            results['ingestion'] = self.input_ingestion.to_dict(ingestion_result)
            emit("subclaims", items=[sc.get('text', '') for sc in ingestion_result.verifiable_subclaims])
            emit("stage", stage="decompose", status="done")
            logger.info(f"✓ Found {len(ingestion_result.verifiable_subclaims)} verifiable subclaims")

            if not ingestion_result.verifiable_subclaims:
                logger.warning("No verifiable subclaims found!")
                results['verdict'] = {
                    'final_verdict': 'NOT_SUPPORTED',
                    'reason': 'No verifiable subclaims'
                }
                emit("notice", level="warning", message="No verifiable factual statements were found in the input.")
                return results

            # AGENT 2: Query Generation
            logger.info("\n[2/6] Query Generation Agent - Creating search queries...")
            emit("stage", stage="queries", status="start")
            query_results = self.query_generation.process(ingestion_result.verifiable_subclaims)
            emit("queries", items=[qr.queries for qr in query_results])
            emit("stage", stage="queries", status="done")
            results['queries'] = [
                {
                    'subclaim_id': qr.subclaim_id,
                    'queries': qr.queries
                }
                for qr in query_results
            ]
            total_queries = sum(len(qr.queries) for qr in query_results)
            logger.info(f"✓ Generated {total_queries} search queries")

            # AGENT 3: Evidence Seeking
            logger.info("\n[3/6] Evidence Seeking Agent - Retrieving evidence...")
            logger.info("     Stage 1: Web Search")
            logger.info("     Stage 2: Credibility Check")
            logger.info("     Stage 3: Content Extraction")

            emit("stage", stage="evidence", status="start")
            evidence_results = self.evidence_seeking.process(query_results, on_event=emit)
            emit("stage", stage="evidence", status="done")
            results['evidence'] = [
                {
                    'total_sources': er.total_sources,
                    'evidence': [asdict(ev) for ev in er.evidence]
                }
                for er in evidence_results
            ]
            total_evidence = sum(er.total_sources for er in evidence_results)
            logger.info(f"✓ Retrieved {total_evidence} evidence items")

            # AGENT 4: Verdict Prediction
            logger.info("\n[4/6] Verdict Prediction Agent - Aggregating evidence...")
            emit("stage", stage="debate", status="start")
            verdict_result = self.verdict_prediction.process(evidence_results, claim=claim, on_event=emit)
            results['verdict'] = self.verdict_prediction.to_dict(verdict_result)
            emit("stage", stage="debate", status="done")
            emit("verdict", final=verdict_result.final_verdict, probs=verdict_result.label_probs)
            logger.info(f"✓ Verdict: {verdict_result.final_verdict})")

            # AGENT 5: Explainable AI (optional)
            if enable_xai:
                try:
                    logger.info("\n[5/6] Explainable AI Agent - Generating explanations...")
                    xai_result = self.explainable_ai.process(verdict_result, evidence_results)
                    results['explanation'] = self.explainable_ai.to_dict(xai_result)
                    quality = xai_result.explanation_quality.get('overall', 0.0)
                    logger.info(f"✓ Explanation quality: {quality:.2f}")
                except Exception as xai_err:
                    logger.warning(f"XAI agent encountered error: {xai_err}")

            # AGENT 6: Reinforcement Learning (optional)
            if enable_rl:
                try:
                    logger.info("\n[6/6] Reinforcement Learning Agent - Recording performance...")
                    run_metrics = self.reinforcement_learning.record_run(
                        claim,
                        verdict_result,
                        evidence_results,
                        ground_truth
                    )
                    results['performance'] = asdict(run_metrics)
                    logger.info(f"✓ Run recorded (accuracy: {run_metrics.accuracy:.2f})")
                except Exception as rl_err:
                    logger.warning(f"RL agent encountered error: {rl_err}")

            logger.info("\n" + "="*80)
            logger.info("VERIFICATION COMPLETE")
            logger.info("="*80)

            return results

        except Exception as e:
            logger.error(f"Error during verification: {e}", exc_info=True)
            results['error'] = str(e)
            return results

    def verify_text(
        self,
        claim: str,
        language: str = "auto",
        on_event=None,
    ) -> Dict[str, Any]:
        """
        Verify a text claim and format the response to strictly match the MLResponse schema
        expected by the VeriLens frontend and API.
        """
        start_time = time.time()
        raw_res = self.verify_claim(claim=claim, enable_xai=True, enable_rl=False, on_event=on_event)
        latency_ms = int((time.time() - start_time) * 1000)

        # Parse verdict
        verdict_data = raw_res.get('verdict') or {}
        raw_final = str(verdict_data.get('final_verdict', '')).upper()
        subclaim_verdicts = verdict_data.get('subclaim_verdicts', [])
        probs = verdict_data.get('label_probs') or {}

        # Flatten retrieved evidence. Stance comes from the debate: evidence cited
        # (with a verified quote) only by the Defender supports, only by the Prosecutor refutes.
        evidence_list = []
        seen = set()
        cred_values = []
        for gi, grp in enumerate(raw_res.get('evidence', [])):
            sv = subclaim_verdicts[gi] if gi < len(subclaim_verdicts) else {}
            debate = sv.get('debate') or {}
            stance_by_key = {
                (e.get('source_url', ''), e.get('passage', '')[:100]): debate.get('evidence_stance', {}).get(e.get('id'), 'Neutral')
                for e in debate.get('evidence', [])
            }
            for ev in grp.get('evidence', []):
                url = ev.get('source_url', '')
                snippet = (ev.get('passage') or '').strip()
                if not snippet or not url.startswith(('http://', 'https://')):
                    continue  # never show evidence we did not actually retrieve
                key = (url, snippet[:100])
                if key in seen:
                    continue
                seen.add(key)

                domain = urllib.parse.urlparse(url).netloc.replace('www.', '')
                cred_score = float(ev.get('credibility_score') or 0.5)
                cred_values.append(cred_score)
                cred_str = 'High' if cred_score >= 0.8 else ('Medium' if cred_score >= 0.5 else 'Low')

                if stance_by_key:
                    stance = stance_by_key.get((url, snippet[:100]), 'Neutral')
                else:
                    stance = {'supported': 'Supports', 'not_supported': 'Refutes'}.get(sv.get('supports'), 'Neutral')

                evidence_list.append({
                    'title': ev.get('source_name') or domain,
                    'url': url,
                    'domain': domain,
                    'snippet': snippet[:300],
                    'credibility': cred_str,
                    'stance': stance,
                })

        # Label and confidence come from the verdict probabilities
        p_s = float(probs.get('supported', 0.0))
        p_r = float(probs.get('refuted', 0.0))
        p_n = float(probs.get('insufficient', 0.0))
        any_supported = any(sv.get('supports') == 'supported' for sv in subclaim_verdicts)

        if raw_final == 'SUPPORTED':
            label, confidence = 'True', p_s
        elif raw_final == 'NOT_SUPPORTED':
            # Some subclaims hold but at least one detail is false -> partly true
            label = 'Misleading' if any_supported and len(subclaim_verdicts) > 1 else 'False'
            confidence = p_r
        else:
            label, confidence = 'Unverifiable', p_n if probs else 0.5

        # Explanation: judge reasoning per subclaim
        expl = verdict_data.get('explanation') or (
            f"Multi-agent verification analyzed the statement against {len(evidence_list)} sources. Verdict: {label}."
        )

        debate_out = [
            {
                'subclaim': sv.get('subclaim', ''),
                'verdict': sv.get('supports'),
                'probs': {
                    'supported': sv.get('p_supported', 0.0),
                    'refuted': sv.get('p_refuted', 0.0),
                    'insufficient': sv.get('p_insufficient', 0.0),
                },
                **{k: sv['debate'][k] for k in ('abstained', 'judge', 'arguments', 'evidence', 'grounding')},
            }
            for sv in subclaim_verdicts if sv.get('debate')
        ]

        return {
            "label": label,
            "confidence": round(float(confidence), 2),
            "clipScore": 0.0,  # no image in text/PDF mode
            "evidenceScore": round(p_s, 2),
            "credibilityScore": round(sum(cred_values) / len(cred_values), 2) if cred_values else 0.0,
            "explanation": expl,
            "language": language if language != "auto" else "en",
            "latencyMs": latency_ms,
            "evidence": evidence_list[:8],
            "verdictMode": verdict_data.get('mode', 'heuristic'),
            "labelProbs": {'supported': round(p_s, 4), 'refuted': round(p_r, 4), 'insufficient': round(p_n, 4)},
            "debate": debate_out or None,
        }

    def get_performance_analysis(self) -> Dict[str, Any]:
        """
        Get performance analysis from RL agent.

        Returns:
            Performance patterns and suggestions
        """
        logger.info("Generating performance analysis...")
        rl_result = self.reinforcement_learning.process()
        return self.reinforcement_learning.to_dict(rl_result)

    def batch_verify(
        self,
        claims: list[tuple[str, Optional[str]]],
        enable_xai: bool = False,
        enable_rl: bool = True
    ) -> list[Dict[str, Any]]:
        """
        Verify multiple claims in batch.

        Args:
            claims: List of (claim, ground_truth) tuples
            enable_xai: Enable XAI for each claim
            enable_rl: Enable RL tracking

        Returns:
            List of results dictionaries
        """
        logger.info(f"Batch verification: {len(claims)} claims")

        results = []
        for i, (claim, ground_truth) in enumerate(claims, 1):
            logger.info(f"\n{'='*80}")
            logger.info(f"Processing claim {i}/{len(claims)}")
            logger.info(f"{'='*80}")

            result = self.verify_claim(
                claim,
                ground_truth=ground_truth,
                enable_xai=enable_xai,
                enable_rl=enable_rl
            )
            results.append(result)

        # Get performance analysis if RL was enabled
        if enable_rl:
            performance = self.get_performance_analysis()
            logger.info("\n" + "="*80)
            logger.info("BATCH PERFORMANCE ANALYSIS")
            logger.info("="*80)
            logger.info(f"Total runs: {performance['metrics'].get('total_runs', 0)}")
            logger.info(f"Mean accuracy: {performance['metrics'].get('mean_accuracy', 0):.2f}")
            logger.info(f"Mean evidence quality: {performance['metrics'].get('mean_evidence_quality', 0):.2f}")
            logger.info("\nSuggestions:")
            for suggestion in performance['suggestions']:
                logger.info(f"  - {suggestion}")

        return results


# Convenience function
def verify_claim(claim: str, ground_truth: Optional[str] = None) -> Dict[str, Any]:
    """
    Convenience function for single claim verification.

    Args:
        claim: Claim to verify
        ground_truth: Optional ground truth label

    Returns:
        Results dictionary
    """
    orchestrator = FactCheckingOrchestrator()
    return orchestrator.verify_claim(claim, ground_truth)

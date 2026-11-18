"""Tests for the evidence-grounded debate verdict (no real LLM needed)."""

import json
from types import SimpleNamespace

import pytest
import yaml

from src.agents.debate import DebateAgent, verify_quote, parse_json_response
from src.agents.verdict_prediction import VerdictPredictionAgent, SubclaimVerdict

PROMPTS = yaml.safe_load(open("config/agent_prompt.yaml", encoding="utf-8"))

EVIDENCE = [
    SimpleNamespace(source_url="https://en.wikipedia.org/wiki/Albert_Einstein", source_name="Albert Einstein",
                    passage="Einstein received the 1921 Nobel Prize in Physics for his services to theoretical "
                            "physics, and especially for his discovery of the law of the photoelectric effect.",
                    credibility_score=0.9),
    SimpleNamespace(source_url="https://example.com/relativity", source_name="Relativity blog",
                    passage="The theory of relativity is one of Einstein's most famous works.",
                    credibility_score=0.4),
]


class ScriptedLLM:
    """Answers advocate and judge prompts with canned JSON and records the prompts it saw."""

    def __init__(self, judge_probs=(0.1, 0.8, 0.1)):
        self.judge_probs = judge_probs
        self.prompts = []

    def generate(self, prompt, **_):
        self.prompts.append(prompt)
        if "impartial Judge" in prompt:
            ps, pr, pn = self.judge_probs
            return "```json\n" + json.dumps({
                "p_supported": ps, "p_refuted": pr, "p_insufficient": pn,
                "winner": "prosecutor", "decisive_evidence": ["e1"],
                "reasoning": "E1 says the prize was for the photoelectric effect, not relativity.",
            }) + "\n```"
        if "You are the Defender" in prompt:
            return json.dumps({
                "argument": "Einstein won the Nobel Prize, and relativity is his famous work.",
                "citations": [
                    {"id": "E2", "quote": "The theory of relativity is one of Einstein's most famous works"},
                    {"id": "E1", "quote": "Einstein won the Nobel Prize for relativity"},  # fabricated
                ],
                "concede": False,
            })
        return json.dumps({
            "argument": "The prize citation names the photoelectric effect.",
            "citations": [{"id": "E1", "quote": "especially for his discovery of the law of the photoelectric effect"}],
            "concede": False,
        })


def test_verify_quote():
    p = EVIDENCE[0].passage
    assert verify_quote("received the 1921 Nobel Prize in Physics", p)
    assert verify_quote("RECEIVED the 1921 nobel prize, in physics!", p)       # case/punctuation
    assert not verify_quote("Einstein won the Nobel Prize for relativity", p)  # fabricated
    assert not verify_quote("Nobel", p)                                        # too short


def test_parse_json_response_tolerates_fences_and_preamble():
    assert parse_json_response('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json_response('Sure! Here you go: {"a": 2}') == {"a": 2}


def test_debate_marks_fabricated_quotes_and_follows_judge():
    llm = ScriptedLLM()
    agent = DebateAgent(llm, PROMPTS, {"rounds": 2})
    r = agent.debate("Einstein won the Nobel Prize for relativity.",
                     "Einstein won the Nobel Prize for relativity.", EVIDENCE)

    assert len(r.arguments) == 4 and r.llm_calls == 5
    defender_cites = [c for a in r.arguments if a.role == "defender" for c in a.citations]
    assert {c.id: c.verified for c in defender_cites} == {"E2": True, "E1": False}
    assert r.grounding == {"defender": 0.5, "prosecutor": 1.0}
    assert r.label == "not_supported" and not r.abstained
    assert r.judge.decisive_evidence == ["E1"]
    # E1 is cited verifiably only by the prosecutor; E2 only by the defender
    assert r.evidence_stance == {"E1": "Refutes", "E2": "Supports"}
    # Judge sees the grounding marks; round 2 advocates see round 1
    judge_prompt = next(p for p in llm.prompts if "impartial Judge" in p)
    assert "FABRICATED" in judge_prompt and "VERIFIED" in judge_prompt
    assert any("Round 1 - PROSECUTOR" in p for p in llm.prompts if "You are the Defender" in p)


def test_debate_abstains_when_judge_is_unsure():
    agent = DebateAgent(ScriptedLLM(judge_probs=(0.45, 0.4, 0.15)), PROMPTS, {"abstain_threshold": 0.5})
    r = agent.debate("c", "c", EVIDENCE)
    assert r.label == "insufficient" and r.abstained


def test_debate_without_evidence_skips_llm():
    llm = ScriptedLLM()
    r = DebateAgent(llm, PROMPTS).debate("c", "c", [])
    assert r.label == "insufficient" and llm.prompts == []


def test_aggregate_probs_is_a_valid_distribution():
    svs = [SubclaimVerdict("supported", "", p_supported=0.8, p_refuted=0.1, p_insufficient=0.1),
           SubclaimVerdict("supported", "", p_supported=0.9, p_refuted=0.05, p_insufficient=0.05)]
    p = VerdictPredictionAgent._aggregate_probs(svs)
    assert p["supported"] == pytest.approx(0.72)
    assert p["refuted"] == pytest.approx(1 - 0.9 * 0.95)
    assert sum(p.values()) == pytest.approx(1.0, abs=1e-3)
    assert min(p.values()) >= 0


def test_verify_text_output_matches_frontend_schema():
    from dataclasses import asdict
    from src.orchestrator import FactCheckingOrchestrator

    agent = VerdictPredictionAgent.__new__(VerdictPredictionAgent)
    agent.config, agent.llm, agent.mode, agent.prompt_template = {}, None, "debate", None
    agent.debate_agent = DebateAgent(ScriptedLLM(), PROMPTS)
    ev_result = SimpleNamespace(subclaim_text="Einstein won the Nobel Prize for relativity.", evidence=EVIDENCE)
    verdict = agent.process([ev_result], claim=ev_result.subclaim_text)

    orch = FactCheckingOrchestrator.__new__(FactCheckingOrchestrator)
    orch.verify_claim = lambda **_: {
        "verdict": agent.to_dict(verdict),
        "evidence": [{"evidence": [vars(e) for e in EVIDENCE]}],
    }
    out = orch.verify_text("Einstein won the Nobel Prize for relativity.")

    assert out["label"] == "False" and out["verdictMode"] == "debate"
    assert out["confidence"] == pytest.approx(0.8, abs=0.01)
    assert [e["stance"] for e in out["evidence"]] == ["Refutes", "Supports"]
    assert out["credibilityScore"] == pytest.approx(0.65)
    d = out["debate"][0]
    assert d["judge"]["winner"] == "prosecutor" and len(d["arguments"]) == 4
    json.dumps(out)  # must be JSON-serialisable for the Node bridge


def test_unreachable_llm_falls_back_to_heuristic_not_fake_debate():
    class DeadLLM:
        def generate(self, prompt, **_):
            raise ConnectionError("ollama not running")

    agent = VerdictPredictionAgent.__new__(VerdictPredictionAgent)
    agent.config, agent.llm, agent.mode = {}, DeadLLM(), "debate"
    agent.prompt_template = PROMPTS["verdict_prediction"]
    agent.debate_agent = DebateAgent(agent.llm, PROMPTS)
    v = agent.process([SimpleNamespace(subclaim_text="Einstein received the 1921 Nobel Prize in Physics",
                                       evidence=EVIDENCE)])
    assert v.mode == "heuristic"
    assert v.final_verdict == "SUPPORTED"  # keyword overlap with E1


def test_debate_streams_events_in_order():
    events = []
    agent = DebateAgent(ScriptedLLM(), PROMPTS, {"rounds": 2})
    r = agent.debate("c", "c", EVIDENCE, on_event=events.append, subclaim_index=3)

    kinds = [e["event"] for e in events]
    assert kinds[0] == "debate_start" and kinds[-2:] == ["judging", "judge"]
    assert kinds.count("thinking") == 4 and kinds.count("argument") == 4
    assert all(e["subclaim_index"] == 3 for e in events)
    # every argument arrives after its own "thinking" event
    for e in events:
        if e["event"] == "argument":
            a = e["argument"]
            think = next(i for i, x in enumerate(events) if x["event"] == "thinking"
                         and x["role"] == a["role"] and x["round"] == a["round"])
            assert think < events.index(e)
    assert events[-1]["label"] == r.label
    json.dumps(events)  # must be serialisable for the stream


def test_quota_exhausted_fails_fast(monkeypatch):
    """A 429 asking to wait hours must raise immediately, not sleep (this hung the site)."""
    from google.genai import errors
    from src.utils.llm_interface import LLMInterface

    llm = LLMInterface.__new__(LLMInterface)
    llm.config = {"llm": {"gemini": {"max_retry_wait": 60}}}
    llm.gemini_model = "x"

    class Models:
        def generate_content(self, **_):
            raise errors.APIError(429, {"error": {"message": "Quota exceeded. Please retry in 48806.2s."}})

    llm.gemini_client = SimpleNamespace(models=Models())
    monkeypatch.setattr("time.sleep", lambda s: pytest.fail(f"slept {s}s"))
    with pytest.raises(RuntimeError, match="quota exhausted"):
        llm._generate_gemini("hi")

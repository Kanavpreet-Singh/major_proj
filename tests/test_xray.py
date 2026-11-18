"""Tests for Article X-Ray (no real LLM or web access needed)."""

import json
from types import SimpleNamespace

from src.xray import ArticleXRay, locate_quote, text_article

ARTICLE = (
    "The Eiffel Tower opened in 1889 for the World’s Fair.\n\n"
    "It is located in Berlin and receives about 7 million visitors a year. "
    "Critics called it “an eyesore” at the time."
)


def test_locate_quote_exact_and_normalised():
    s, e = locate_quote(ARTICLE, "The Eiffel Tower opened in 1889")
    assert ARTICLE[s:e] == "The Eiffel Tower opened in 1889"
    # straight quotes and different whitespace still match curly quotes in the article
    s, e = locate_quote(ARTICLE, "Critics called it 'an eyesore'  at the time")
    assert ARTICLE[s:e].startswith("Critics called it") and ARTICLE[s:e].endswith("at the time")


def test_locate_quote_falls_back_to_best_sentence():
    s, e = locate_quote(ARTICLE, "the tower is located in Berlin and gets 7 million visitors yearly")
    assert "located in Berlin" in ARTICLE[s:e]
    assert locate_quote(ARTICLE, "completely unrelated words here") is None


def test_text_article_uses_first_short_line_as_title():
    a = text_article("Big News Today\nSomething happened in Paris on Monday.")
    assert a["title"] == "Big News Today" and a["text"] == "Something happened in Paris on Monday."
    b = text_article("It rained.\nThen it stopped.")  # a sentence, not a headline
    assert b["title"] == "Pasted text" and b["text"].startswith("It rained.")


class FakeLLM:
    def generate(self, prompt, **_):
        assert "Eiffel Tower" in prompt
        return "```json\n" + json.dumps({"claims": [
            {"quote": "It is located in Berlin", "claim": "The Eiffel Tower is located in Berlin.",
             "checkworthiness": 0.95, "category": "place"},
            {"quote": "The Eiffel Tower opened in 1889", "claim": "The Eiffel Tower opened in 1889.",
             "checkworthiness": 0.8, "category": "date"},
            {"quote": "opened in 1889 for", "claim": "duplicate overlapping span", "checkworthiness": 0.5},
            {"quote": "not in the article at all", "claim": "x", "checkworthiness": 0.9},
        ]}) + "\n```"


def test_extract_claims_locates_dedupes_and_orders():
    xr = ArticleXRay.__new__(ArticleXRay)
    xr.cfg, xr.llm = {"max_claims": 5}, FakeLLM()
    xr.extract_prompt = "Article: {article} max {max_claims}"
    claims = xr.extract_claims(ARTICLE)

    assert [c["claim"] for c in claims] == ["The Eiffel Tower opened in 1889.", "The Eiffel Tower is located in Berlin."]
    assert [c["index"] for c in claims] == [0, 1]  # numbered in reading order
    for c in claims:
        assert ARTICLE[c["start"]:c["end"]] == c["quote"]


def test_run_streams_events_tagged_by_claim():
    """Full run with stubbed evidence and verdict agents: events carry claim_index, summary is right."""
    xr = ArticleXRay.__new__(ArticleXRay)
    xr.cfg = {"max_claims": 5, "max_article_chars": 12000, "parallel_claims": 2}
    xr.llm, xr.extract_prompt = FakeLLM(), "Article: {article} max {max_claims}"

    class Evidence:
        def process(self, qrs, on_event=None):
            on_event("evidence", subclaim_index=0, count=1, sources=[])
            ev = SimpleNamespace(source_url="https://x.org", source_name="X", passage="p")
            return [SimpleNamespace(subclaim_text=qrs[0].subclaim_text, evidence=[ev])]

    class Verdict:
        def process(self, evidence, claim=None, on_event=None):
            berlin = "Berlin" in claim
            sv = SimpleNamespace(supports="not_supported" if berlin else "supported",
                                 p_supported=0.1 if berlin else 0.9, p_refuted=0.9 if berlin else 0.1,
                                 p_insufficient=0.0, claim="reason", method="debate", debate=None)
            return SimpleNamespace(subclaim_verdicts=[sv])

    xr.evidence_agent, xr.verdict_agent = Evidence(), Verdict()
    events = []
    out = xr.run(text=ARTICLE, on_event=events.append)

    assert out["summary"] == {"total": 2, "supported": 1, "not_supported": 1, "insufficient": 0, "truth_score": 0.5}
    tagged = [e for e in events if e["event"] in ("evidence", "claim_status", "claim_result")]
    assert tagged and all("claim_index" in e for e in tagged)
    assert {e["claim_index"] for e in events if e["event"] == "claim_result"} == {0, 1}
    json.dumps(out)

"""
Article X-Ray: find the check-worthy claims in a news article and fact-check each one.

Pipeline
  1. Fetch the article (or take pasted text) and keep its paragraphs.
  2. One LLM call extracts check-worthy claims. For each it returns the exact sentence
     (so the UI can highlight it) and a decontextualised, standalone version of the claim
     (pronouns resolved, context added) that can be verified on its own.
  3. Each claim is verified independently: web evidence (no LLM) followed by a short
     grounded debate (Defender + Prosecutor + Judge). Claims run in parallel.

Progress is reported through `on_event` so the frontend can stream it live.
"""

import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict
from types import SimpleNamespace
from typing import Any, Callable, Dict, List, Optional
from urllib.parse import urlparse

import requests
import yaml
from bs4 import BeautifulSoup
from loguru import logger

from src.agents.verdict_prediction import VerdictPredictionAgent
from src.utils.events import EventEmitter, as_emitter
from src.utils.json_utils import parse_json_response

_STOP = {
    'is', 'the', 'a', 'an', 'in', 'of', 'for', 'to', 'and', 'that', 'this', 'with', 'by', 'on',
    'at', 'as', 'it', 'be', 'was', 'were', 'are', 'from', 'has', 'have', 'had', 'its', 'their',
}

DEFAULTS = {
    "max_claims": 4,
    "max_article_chars": 12000,
    "debate_rounds": 1,
    "parallel_claims": 3,
}


def _load_config() -> Dict[str, Any]:
    base = os.path.join(os.path.dirname(__file__), "..", "config")
    with open(os.path.join(base, "agent_config.yaml"), encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    with open(os.path.join(base, "agent_prompt.yaml"), encoding="utf-8") as f:
        prompts = yaml.safe_load(f) or {}
    return {**DEFAULTS, **(cfg.get("xray") or {})}, cfg, prompts


# ----------------------------------------------------------------------------
# Article fetching
# ----------------------------------------------------------------------------

def fetch_article(url: str, timeout: int = 15) -> Dict[str, str]:
    """Download a web page and keep the article's paragraphs (headline + body text)."""
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                             "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"}
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    title = ""
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        title = og["content"].strip()
    elif soup.find("h1"):
        title = soup.find("h1").get_text(" ", strip=True)
    elif soup.title:
        title = soup.title.get_text(" ", strip=True)

    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form", "figure", "noscript"]):
        tag.decompose()
    root = soup.find("article") or soup.find("main") or soup.find(attrs={"role": "main"}) or soup.body or soup
    paragraphs = []
    for p in root.find_all(["p", "h2", "h3"]):  # lists on news pages are mostly related-link clutter
        text = re.sub(r"\s+", " ", p.get_text(" ", strip=True))
        text = re.sub(r"\[\s*\d+\s*\]", "", text).strip()  # Wikipedia-style citation markers
        if len(text) >= 40:
            if not paragraphs or paragraphs[-1] != text:
                paragraphs.append(text)
    if not paragraphs:
        raise ValueError("Could not find any article text on that page.")
    return {"title": title or urlparse(url).netloc, "text": "\n\n".join(paragraphs), "url": url}


def text_article(text: str) -> Dict[str, str]:
    text = re.sub(r"\r\n?", "\n", text).strip()
    paragraphs = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n|\n", text)]
    paragraphs = [p for p in paragraphs if p]
    first = paragraphs[0] if paragraphs else ""
    # A short first line followed by more text is a headline: show it as the title, not in the body
    if len(first) <= 120 and len(paragraphs) > 1 and not first.endswith((".", "!", "?")):
        return {"title": first, "text": "\n\n".join(paragraphs[1:]), "url": ""}
    return {"title": "Pasted text", "text": "\n\n".join(paragraphs), "url": ""}


# ----------------------------------------------------------------------------
# Locating quotes in the article (for highlighting)
# ----------------------------------------------------------------------------

_QUOTE_CHARS = str.maketrans({"‘": "'", "’": "'", "“": "'", "”": "'", '"': "'",
                              "–": "-", "—": "-"})


def _normalise_with_map(text: str):
    """Lower-cased text with unified quotes and collapsed whitespace, plus a map back to original offsets."""
    out, idx, prev_space = [], [], False
    for i, ch in enumerate(text.translate(_QUOTE_CHARS)):
        if ch.isspace():
            if prev_space:
                continue
            ch, prev_space = " ", True
        else:
            prev_space = False
        out.append(ch.lower())
        idx.append(i)
    return "".join(out), idx


def locate_quote(text: str, quote: str) -> Optional[tuple]:
    """Character span of `quote` in `text`: exact (normalised) match, else the best-matching sentence."""
    quote = (quote or "").strip()
    if not quote:
        return None
    norm_text, idx = _normalise_with_map(text)
    norm_q, _ = _normalise_with_map(quote)
    norm_q = norm_q.strip(" .'")
    pos = norm_text.find(norm_q) if len(norm_q) >= 12 else -1
    if pos >= 0:
        return idx[pos], idx[pos + len(norm_q) - 1] + 1

    # Fallback: the sentence sharing the most words with the quote
    q_words = set(re.findall(r"\w+", quote.lower())) - _STOP
    if not q_words:
        return None
    best, best_score = None, 0.0
    for m in re.finditer(r"[^.!?\n]+[.!?]?", text):
        words = set(re.findall(r"\w+", m.group().lower()))
        score = len(q_words & words) / len(q_words)
        if score > best_score:
            best, best_score = m, score
    if best is not None and best_score >= 0.6:
        start = best.start() + (len(best.group()) - len(best.group().lstrip()))
        return start, best.end()
    return None


# ----------------------------------------------------------------------------
# X-Ray
# ----------------------------------------------------------------------------

class ArticleXRay:
    def __init__(self, llm, evidence_agent, config: Optional[Dict[str, Any]] = None):
        cfg, agent_cfg, prompts = _load_config()
        if config:
            cfg.update(config)
        self.cfg = cfg
        self.llm = llm
        self.evidence_agent = evidence_agent
        self.extract_prompt = prompts.get("xray_claim_extraction")
        verdict_cfg = dict(agent_cfg.get("verdict_prediction") or {})
        verdict_cfg["mode"] = "debate"
        verdict_cfg["debate"] = {**(verdict_cfg.get("debate") or {}), "rounds": int(cfg["debate_rounds"])}
        self.verdict_agent = VerdictPredictionAgent(config=verdict_cfg, llm_interface=llm)

    # ------------------------------------------------------------------ public

    def run(self, url: str = "", text: str = "", on_event: Optional[Callable] = None) -> Dict[str, Any]:
        emit = as_emitter(on_event)
        started = time.time()

        emit("stage", stage="fetch", status="start")
        article = fetch_article(url) if url else text_article(text)
        truncated = len(article["text"]) > self.cfg["max_article_chars"]
        if truncated:
            cut = article["text"].rfind("\n\n", 0, self.cfg["max_article_chars"])
            article["text"] = article["text"][: cut if cut > 0 else self.cfg["max_article_chars"]]
        emit("article", title=article["title"], url=article["url"], text=article["text"], truncated=truncated)
        emit("stage", stage="fetch", status="done")

        emit("stage", stage="extract", status="start")
        claims = self.extract_claims(article["text"])
        emit("claims", items=claims)
        emit("stage", stage="extract", status="done")
        if not claims:
            emit("notice", level="warning", message="No check-worthy factual claims were found in this text.")

        emit("stage", stage="check", status="start")
        results: Dict[int, Dict[str, Any]] = {}
        with ThreadPoolExecutor(max_workers=max(1, int(self.cfg["parallel_claims"]))) as pool:
            futures = {pool.submit(self._check_claim, c, emit): c["index"] for c in claims}
            for fut in as_completed(futures):
                i = futures[fut]
                try:
                    results[i] = fut.result()
                except Exception as e:
                    logger.warning(f"X-Ray claim {i} failed: {e}")
                    results[i] = {"label": "insufficient", "probs": {"supported": 0, "refuted": 0, "insufficient": 1},
                                  "explanation": f"This claim could not be checked: {str(e)[:160]}",
                                  "method": "error", "debate": None, "sources": []}
                    emit("claim_result", claim_index=i, **results[i])
        emit("stage", stage="check", status="done")

        checked = [{**c, **results.get(c["index"], {})} for c in claims]
        counts = {k: sum(c.get("label") == k for c in checked) for k in ("supported", "not_supported", "insufficient")}
        decided = counts["supported"] + counts["not_supported"]
        summary = {
            "total": len(checked),
            **counts,
            "truth_score": round(counts["supported"] / decided, 4) if decided else None,
        }
        emit("summary", **summary)
        return {
            "kind": "xray",
            "title": article["title"],
            "url": article["url"],
            "text": article["text"],
            "truncated": truncated,
            "claims": checked,
            "summary": summary,
            "latencyMs": int((time.time() - started) * 1000),
        }

    # ------------------------------------------------------------------ steps

    def extract_claims(self, text: str) -> List[Dict[str, Any]]:
        if not (self.llm and self.extract_prompt):
            raise RuntimeError("Article X-Ray needs an LLM to find claims (check GEMINI_API_KEY).")
        prompt = self.extract_prompt.format(article=text, max_claims=self.cfg["max_claims"])
        data = parse_json_response(self.llm.generate(prompt=prompt))
        raw = data.get("claims", []) if isinstance(data, dict) else data
        claims, taken = [], []
        for c in sorted(raw or [], key=lambda c: -float(c.get("checkworthiness", 0) or 0)):
            span = locate_quote(text, str(c.get("quote", "")))
            claim_text = str(c.get("claim", "")).strip()
            if not span or not claim_text:
                continue
            if any(span[0] < e and span[1] > s for s, e in taken):  # overlapping highlight
                continue
            taken.append(span)
            claims.append({
                "quote": text[span[0]:span[1]],
                "claim": claim_text,
                "start": span[0],
                "end": span[1],
                "checkworthiness": round(float(c.get("checkworthiness", 0) or 0), 2),
                "category": str(c.get("category", "other")),
            })
            if len(claims) >= self.cfg["max_claims"]:
                break
        # Number claims in reading order
        claims.sort(key=lambda c: c["start"])
        for i, c in enumerate(claims):
            c["index"] = i
        return claims

    def _check_claim(self, claim: Dict[str, Any], parent: EventEmitter) -> Dict[str, Any]:
        i = claim["index"]  # `parent` is shared by all claims, so its lock serialises their events
        # Tag every event from the shared agents with this claim's index
        emit = EventEmitter((lambda ev: parent(ev.pop("event"), claim_index=i, **ev)) if parent else None)

        emit("claim_status", status="searching")
        keywords = " ".join(w for w in re.findall(r"\w+", claim["claim"]) if w.lower() not in _STOP)[:120]
        qr = SimpleNamespace(subclaim_id=f"claim_{i}", subclaim_text=claim["claim"],
                             queries=list(dict.fromkeys([claim["claim"], keywords])))
        evidence = self.evidence_agent.process([qr], on_event=emit)

        emit("claim_status", status="debating")
        verdict = self.verdict_agent.process(evidence, claim=claim["claim"], on_event=emit)
        sv = verdict.subclaim_verdicts[0]
        debate = None
        if sv.debate:
            d = sv.debate
            debate = {
                "subclaim": claim["claim"], "verdict": sv.supports,
                "probs": {"supported": sv.p_supported, "refuted": sv.p_refuted, "insufficient": sv.p_insufficient},
                **{k: d[k] for k in ("abstained", "judge", "arguments", "evidence", "grounding")},
            }
        sources, seen = [], set()
        for ev in evidence[0].evidence:
            if ev.source_url and ev.source_url not in seen:
                seen.add(ev.source_url)
                sources.append({"title": ev.source_name, "url": ev.source_url})
        result = {
            "label": sv.supports,
            "probs": {"supported": sv.p_supported, "refuted": sv.p_refuted, "insufficient": sv.p_insufficient},
            "explanation": sv.claim,
            "method": sv.method,
            "debate": debate,
            "sources": sources[:6],
        }
        emit("claim_result", **result)
        return result

"""
Evidence-Grounded Debate - Prosecutor vs Defender, decided by a Judge.

For one subclaim and its retrieved evidence:

  Round 1..R:  Defender argues the subclaim is SUPPORTED,
               Prosecutor argues it is REFUTED.
               Both may only cite retrieved evidence, by ID, with a verbatim quote.
  Grounding:   Every quote is checked automatically against the cited passage.
               Quotes that are not found are marked FABRICATED.
  Judge:       Reads evidence + transcript (with grounding marks) and outputs
               calibrated probabilities over {supported, refuted, insufficient}.
  Abstain:     If 'insufficient' wins, or no outcome is confident enough,
               the subclaim verdict is 'insufficient' instead of a guess.
"""

import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

from loguru import logger

from src.utils.json_utils import parse_json_response  # noqa: F401  (re-exported)


# ----------------------------------------------------------------------------
# Data structures
# ----------------------------------------------------------------------------

@dataclass
class Citation:
    id: str
    quote: str
    verified: bool


@dataclass
class Argument:
    role: str                    # "defender" | "prosecutor"
    round: int
    argument: str
    citations: List[Citation]
    conceded: bool = False

    @property
    def grounding_rate(self) -> Optional[float]:
        if not self.citations:
            return None
        return sum(c.verified for c in self.citations) / len(self.citations)


@dataclass
class JudgeDecision:
    p_supported: float
    p_refuted: float
    p_insufficient: float
    winner: str                  # "defender" | "prosecutor" | "tie"
    decisive_evidence: List[str]
    reasoning: str


@dataclass
class DebateResult:
    subclaim: str
    label: str                   # "supported" | "not_supported" | "insufficient"
    abstained: bool
    judge: JudgeDecision
    arguments: List[Argument]
    evidence: List[Dict[str, Any]]           # [{id, source_name, source_url, passage, credibility}]
    evidence_stance: Dict[str, str]          # evidence id -> Supports | Refutes | Neutral
    grounding: Dict[str, Optional[float]]    # role -> verified-quote rate
    llm_calls: int = 0
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        return d


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokens(text: str) -> List[str]:
    return _TOKEN_RE.findall((text or "").lower())


def verify_quote(quote: str, passage: str, min_overlap: float = 0.85) -> bool:
    """
    A quote is grounded if it appears in the passage, ignoring case and
    punctuation. Small paraphrase slack is allowed: at least `min_overlap` of
    the quote's tokens must appear in the passage, and quotes under 3 tokens
    are rejected (too short to be meaningful evidence).
    """
    q = _tokens(quote)
    if len(q) < 3:
        return False
    p_tokens = _tokens(passage)
    if " ".join(q) in " ".join(p_tokens):
        return True
    p_set = set(p_tokens)
    return sum(t in p_set for t in q) / len(q) >= min_overlap


def _as_prob(x: Any) -> float:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return 0.0
    if v > 1.0:          # model answered in percent
        v /= 100.0
    return min(1.0, max(0.0, v))


# ----------------------------------------------------------------------------
# Debate agent
# ----------------------------------------------------------------------------

ROLE_INSTRUCTIONS = {
    "defender": (
        "Defender",
        "Argue that the evidence SUPPORTS the subclaim (it is true).",
    ),
    "prosecutor": (
        "Prosecutor",
        "Argue that the evidence REFUTES the subclaim (it is false), or that it "
        "contains an error in a detail such as a date, number, name or place.",
    ),
}


class DebateAgent:
    """Runs a grounded Prosecutor/Defender/Judge debate for one subclaim."""

    def __init__(self, llm, prompts: Dict[str, str], config: Dict[str, Any] = None):
        self.llm = llm
        self.advocate_prompt = prompts.get("debate_advocate")
        self.judge_prompt = prompts.get("debate_judge")
        if not self.advocate_prompt or not self.judge_prompt:
            raise ValueError("debate_advocate / debate_judge prompts missing from agent_prompt.yaml")

        cfg = config or {}
        self.rounds = int(cfg.get("rounds", 2))
        self.max_evidence = int(cfg.get("max_evidence", 8))
        self.abstain_threshold = float(cfg.get("abstain_threshold", 0.5))
        self.max_passage_chars = int(cfg.get("max_passage_chars", 600))

    # ------------------------------------------------------------------ public

    def debate(self, claim: str, subclaim: str, evidence: List[Any]) -> DebateResult:
        ev_table = self._build_evidence_table(evidence)
        errors: List[str] = []
        calls = 0

        if not ev_table:
            judge = JudgeDecision(0.0, 0.0, 1.0, "tie", [], "No evidence was retrieved for this subclaim.")
            return DebateResult(subclaim, "insufficient", True, judge, [], [], {},
                                {"defender": None, "prosecutor": None}, 0, [])

        ev_text = self._format_evidence(ev_table)
        passages = {e["id"]: e["passage"] for e in ev_table}
        arguments: List[Argument] = []

        for rnd in range(1, self.rounds + 1):
            transcript = self._format_transcript(arguments)
            # Both sides argue simultaneously from the same transcript, so
            # neither gets a last-word advantage within a round.
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = {
                    role: pool.submit(self._argue, role, rnd, claim, subclaim, ev_text, transcript, passages)
                    for role in ("defender", "prosecutor")
                }
                for role in ("defender", "prosecutor"):
                    calls += 1
                    try:
                        arguments.append(futures[role].result())
                    except Exception as e:
                        logger.warning(f"Debate {role} round {rnd} failed: {e}")
                        errors.append(f"{role} r{rnd}: {e}")

        calls += 1
        try:
            judge = self._judge(claim, subclaim, ev_text, arguments)
        except Exception as e:
            # Without a ruling there is no verdict; let the caller fall back
            # rather than report a made-up "insufficient" with full confidence.
            raise RuntimeError(f"Debate judge failed ({'; '.join(errors + [str(e)])})") from e

        label, abstained = self._decide(judge)
        return DebateResult(
            subclaim=subclaim,
            label=label,
            abstained=abstained,
            judge=judge,
            arguments=arguments,
            evidence=ev_table,
            evidence_stance=self._evidence_stance(arguments, ev_table, judge, label),
            grounding={
                role: self._grounding_rate([a for a in arguments if a.role == role])
                for role in ("defender", "prosecutor")
            },
            llm_calls=calls,
            errors=errors,
        )

    # ----------------------------------------------------------------- stages

    def _argue(self, role, rnd, claim, subclaim, ev_text, transcript, passages) -> Argument:
        role_name, instruction = ROLE_INSTRUCTIONS[role]
        prompt = self.advocate_prompt.format(
            role_name=role_name,
            stance_instruction=instruction,
            claim=claim,
            subclaim=subclaim,
            evidence=ev_text,
            transcript=transcript or "(no arguments yet; this is the opening round)",
            round=rnd,
        )
        data = parse_json_response(self.llm.generate(prompt=prompt))
        citations = []
        for c in data.get("citations") or []:
            if not isinstance(c, dict):
                continue
            cid = str(c.get("id", "")).strip().upper()
            quote = str(c.get("quote", "")).strip()
            verified = cid in passages and verify_quote(quote, passages[cid])
            citations.append(Citation(id=cid, quote=quote, verified=verified))
        return Argument(
            role=role,
            round=rnd,
            argument=str(data.get("argument", "")).strip(),
            citations=citations,
            conceded=bool(data.get("concede", False)),
        )

    def _judge(self, claim, subclaim, ev_text, arguments) -> JudgeDecision:
        prompt = self.judge_prompt.format(
            claim=claim,
            subclaim=subclaim,
            evidence=ev_text,
            transcript=self._format_transcript(arguments, show_grounding=True) or "(both sides failed to argue)",
        )
        data = parse_json_response(self.llm.generate(prompt=prompt))
        ps = _as_prob(data.get("p_supported"))
        pr = _as_prob(data.get("p_refuted"))
        pn = _as_prob(data.get("p_insufficient"))
        total = ps + pr + pn
        if total <= 0:
            ps, pr, pn = 0.0, 0.0, 1.0
        else:
            ps, pr, pn = ps / total, pr / total, pn / total
        winner = str(data.get("winner", "tie")).lower()
        if winner not in ("defender", "prosecutor", "tie"):
            winner = "tie"
        return JudgeDecision(
            p_supported=round(ps, 4),
            p_refuted=round(pr, 4),
            p_insufficient=round(pn, 4),
            winner=winner,
            decisive_evidence=[str(x).upper() for x in (data.get("decisive_evidence") or [])],
            reasoning=str(data.get("reasoning", "")).strip(),
        )

    def _decide(self, judge: JudgeDecision):
        scores = {
            "supported": judge.p_supported,
            "not_supported": judge.p_refuted,
            "insufficient": judge.p_insufficient,
        }
        best = max(scores, key=scores.get)
        if best == "insufficient" or scores[best] < self.abstain_threshold:
            return "insufficient", True
        return best, False

    # ---------------------------------------------------------------- helpers

    def _build_evidence_table(self, evidence: List[Any]) -> List[Dict[str, Any]]:
        """Deduplicate passages, rank by credibility, assign stable IDs E1..En."""
        seen, rows = set(), []
        for ev in evidence or []:
            passage = (getattr(ev, "passage", "") or "").strip()
            if not passage:
                continue
            key = " ".join(_tokens(passage))[:200]
            if key in seen:
                continue
            seen.add(key)
            rows.append({
                "source_name": getattr(ev, "source_name", "") or getattr(ev, "source_url", "Source"),
                "source_url": getattr(ev, "source_url", ""),
                "passage": passage[: self.max_passage_chars],
                "credibility": float(getattr(ev, "credibility_score", 0.5) or 0.5),
            })
        rows.sort(key=lambda r: r["credibility"], reverse=True)
        rows = rows[: self.max_evidence]
        for i, r in enumerate(rows, 1):
            r["id"] = f"E{i}"
        return rows

    @staticmethod
    def _format_evidence(table: List[Dict[str, Any]]) -> str:
        return "\n".join(
            f"[{e['id']}] (source: {e['source_name']}, credibility {e['credibility']:.2f})\n{e['passage']}"
            for e in table
        )

    @staticmethod
    def _format_transcript(arguments: List[Argument], show_grounding: bool = False) -> str:
        lines = []
        for a in arguments:
            head = f"Round {a.round} - {a.role.upper()}" + (" (concedes)" if a.conceded else "")
            lines.append(f"{head}: {a.argument}")
            for c in a.citations:
                mark = (" [VERIFIED]" if c.verified else " [FABRICATED - quote not found in evidence]") if show_grounding else ""
                lines.append(f"    cites {c.id}: '{c.quote}'{mark}")
        return "\n".join(lines)

    @staticmethod
    def _grounding_rate(args: List[Argument]) -> Optional[float]:
        cites = [c for a in args for c in a.citations]
        if not cites:
            return None
        return round(sum(c.verified for c in cites) / len(cites), 4)

    @staticmethod
    def _evidence_stance(arguments: List[Argument], table: List[Dict[str, Any]],
                         judge: JudgeDecision, label: str) -> Dict[str, str]:
        """
        1. Evidence the judge called decisive takes the stance of the ruling.
        2. Otherwise: verifiably cited only by the Defender -> Supports, only by the
           Prosecutor -> Refutes. Citations made while conceding do not count.
        """
        def cited(role):
            return {c.id for a in arguments if a.role == role and not a.conceded
                    for c in a.citations if c.verified}
        by_def, by_pro = cited("defender"), cited("prosecutor")
        ruling = {"supported": "Supports", "not_supported": "Refutes"}.get(label)
        decisive = set(judge.decisive_evidence) if ruling else set()
        stance = {}
        for e in table:
            i = e["id"]
            if i in decisive:
                stance[i] = ruling
            else:
                d, p = i in by_def, i in by_pro
                stance[i] = "Supports" if d and not p else "Refutes" if p and not d else "Neutral"
        return stance

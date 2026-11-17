"""Tolerant JSON parsing for LLM responses."""

import json
import re
from typing import Any


def parse_json_response(text: str) -> Any:
    """Parse JSON from an LLM response, tolerating markdown fences and preamble."""
    s = (text or "").strip()
    if "```" in s:
        m = re.search(r"```(?:json)?\s*(.*?)```", s, re.DOTALL)
        if m:
            s = m.group(1).strip()
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", s, re.DOTALL)
        if m:
            return json.loads(m.group(0))
        raise

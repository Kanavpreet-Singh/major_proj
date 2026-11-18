"""
Progress events for live streaming of the pipeline to the frontend.

Agents call `emit("type", **data)`. With no sink attached, emitting is a no-op, so
batch runs and evaluations are unaffected. The debate runs Defender and Prosecutor in
parallel threads, so emitting is serialised with a lock.
"""

import threading
from typing import Any, Callable, Dict, Optional

from loguru import logger


class EventEmitter:
    def __init__(self, sink: Optional[Callable[[Dict[str, Any]], None]] = None):
        self._sink = sink
        self._lock = threading.Lock()

    def __call__(self, event_type: str, **data: Any) -> None:
        if self._sink is None:
            return
        with self._lock:
            try:
                self._sink({"event": event_type, **data})
            except Exception as e:  # a broken sink must never break the pipeline
                logger.debug(f"Event sink failed: {e}")

    def __bool__(self) -> bool:
        return self._sink is not None


def as_emitter(on_event: Any) -> EventEmitter:
    if isinstance(on_event, EventEmitter):
        return on_event
    return EventEmitter(on_event)

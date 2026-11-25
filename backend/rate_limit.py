"""Small in-memory sliding-window rate limiter.

Good enough for a single server instance. If Nova is ever scaled to several
instances, move the counters to Redis.
"""

import threading
import time
from collections import defaultdict
from collections import deque

from fastapi import HTTPException
from fastapi import Request


class SlidingWindowLimiter:
    def __init__(self):
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_seconds: int) -> None:
        if limit <= 0:
            return

        now = time.monotonic()

        with self._lock:
            hits = self._hits[key]

            while hits and now - hits[0] >= window_seconds:
                hits.popleft()

            if len(hits) >= limit:
                retry_after = max(1, int(window_seconds - (now - hits[0])))
                raise HTTPException(
                    status_code=429,
                    detail=_message(window_seconds, retry_after),
                    headers={"Retry-After": str(retry_after)},
                )

            hits.append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


def _message(window_seconds: int, retry_after: int) -> str:
    if window_seconds >= 86400:
        return "You've reached today's message limit. Please come back tomorrow."

    if retry_after >= 120:
        minutes = retry_after // 60
        return f"You're sending requests too quickly. Try again in {minutes} minutes."

    return f"You're sending requests too quickly. Try again in {retry_after} seconds."


limiter = SlidingWindowLimiter()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")

    if forwarded:
        return forwarded.split(",")[0].strip()

    return request.client.host if request.client else "unknown"

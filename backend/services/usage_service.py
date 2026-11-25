"""Usage tracking: record every Gemini call and summarise consumption against limits.

Token counts come from Gemini itself (`usage_metadata` on each response), so they match
what Google bills/limits. Google doesn't expose *remaining* quota through the API, so
"left" is computed from Nova's own records against the limits in settings.GEMINI_LIMITS.
"""

import logging
from collections import defaultdict
from datetime import datetime
from datetime import timedelta
from datetime import timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from config.settings import settings
from database.models import UsageEvent
from database.models import User
from database.models import utcnow


logger = logging.getLogger("nova.usage")

# Calls that reached Gemini (our own rate-limit rejections never do).
GEMINI_KINDS = ("chat", "title")


# ------------------------------------------------------------
# Recording
# ------------------------------------------------------------

def record(
    db: Session,
    *,
    user_id: str | None,
    conversation_id: str | None,
    kind: str,
    nova_model: str | None,
    meta: dict,
    status: str,
    latency_ms: int | None,
) -> None:
    """Store one usage row. Never raises: tracking must not break chat."""

    usage = meta.get("usage") or {}

    try:
        db.add(
            UsageEvent(
                id=str(uuid4()),
                user_id=user_id,
                conversation_id=conversation_id,
                kind=kind,
                nova_model=nova_model,
                gemini_model=meta.get("gemini_model"),
                input_tokens=usage.get("input", 0),
                output_tokens=usage.get("output", 0),
                thinking_tokens=usage.get("thinking", 0),
                total_tokens=usage.get("total", 0),
                attempts=meta.get("attempts", 1),
                latency_ms=latency_ms,
                first_token_ms=meta.get("first_token_ms"),
                status=status,
                error_code=meta.get("error_code"),
            )
        )
        db.commit()
    except Exception:
        logger.exception("Couldn't record usage")
        db.rollback()


# ------------------------------------------------------------
# Time windows
# ------------------------------------------------------------

def quota_day_start(now_utc: datetime) -> datetime:
    """Start of the current quota day (midnight in the quota timezone), as naive UTC."""

    zone = ZoneInfo(settings.QUOTA_TIMEZONE)
    local = now_utc.replace(tzinfo=timezone.utc).astimezone(zone)
    midnight = local.replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight.astimezone(timezone.utc).replace(tzinfo=None)


def quota_day(value: datetime) -> str:
    zone = ZoneInfo(settings.QUOTA_TIMEZONE)
    return value.replace(tzinfo=timezone.utc).astimezone(zone).date().isoformat()


def iso(value: datetime | None) -> str | None:
    return value.isoformat() + "Z" if value else None


# ------------------------------------------------------------
# Per-user limit (used by the chat route)
# ------------------------------------------------------------

def user_messages_last_24h(db: Session, user_id: str) -> int:
    since = utcnow() - timedelta(hours=24)
    return (
        db.query(UsageEvent)
        .filter(
            UsageEvent.user_id == user_id,
            UsageEvent.kind == "chat",
            UsageEvent.created_at >= since,
        )
        .count()
    )


# ------------------------------------------------------------
# Summary for the dashboard
# ------------------------------------------------------------

def _models_using(gemini_model: str) -> list[str]:
    from providers.gemini_provider import NOVA_MODELS

    names = [name for name, resolve in NOVA_MODELS.items() if resolve()[0] == gemini_model]

    if gemini_model == settings.MODEL_UTILITY:
        names.append("Chat titles")

    if gemini_model == settings.MODEL_FALLBACK and "Fallback" not in names:
        names.append("Fallback")

    return names


def _totals(events) -> dict:
    return {
        "requests": len(events),
        "inputTokens": sum(e.input_tokens for e in events),
        "outputTokens": sum(e.output_tokens for e in events),
        "thinkingTokens": sum(e.thinking_tokens for e in events),
        "totalTokens": sum(e.total_tokens for e in events),
        "errors": sum(1 for e in events if e.status in ("error", "rate_limited")),
    }


def _avg(values) -> int | None:
    values = [v for v in values if v is not None]
    return int(sum(values) / len(values)) if values else None


def is_admin(user: User) -> bool:
    return user.email.lower() in settings.ADMIN_EMAILS


def summary(db: Session, user: User, days: int = 30) -> dict:
    now = utcnow()
    day_start = quota_day_start(now)
    next_reset = day_start + timedelta(days=1)
    minute_ago = now - timedelta(seconds=60)
    period_start = min(day_start, now - timedelta(days=days))

    events = (
        db.query(UsageEvent)
        .filter(UsageEvent.created_at >= period_start, UsageEvent.kind.in_(GEMINI_KINDS))
        .order_by(UsageEvent.created_at.asc())
        .all()
    )

    today = [e for e in events if e.created_at >= day_start]
    last_minute = [e for e in events if e.created_at >= minute_ago]

    # ---- Per Gemini model: used vs limit ----
    model_names = list(settings.GEMINI_LIMITS.keys())
    for event in events:
        if event.gemini_model and event.gemini_model not in model_names:
            model_names.append(event.gemini_model)

    models = []
    for name in model_names:
        limits = settings.GEMINI_LIMITS.get(name, {})
        model_today = [e for e in today if e.gemini_model == name]
        model_minute = [e for e in last_minute if e.gemini_model == name]
        rpd = limits.get("rpd")
        used = len(model_today)

        models.append(
            {
                "model": name,
                "usedBy": _models_using(name),
                "requestsToday": used,
                "rpdLimit": rpd,
                "remainingToday": max(rpd - used, 0) if rpd else None,
                "requestsLastMinute": len(model_minute),
                "rpmLimit": limits.get("rpm"),
                "tokensLastMinute": sum(e.total_tokens for e in model_minute),
                "tpmLimit": limits.get("tpm"),
                "tokensToday": sum(e.total_tokens for e in model_today),
            }
        )

    # ---- Daily series (quota days) ----
    daily_map: dict[str, list] = defaultdict(list)
    for event in events:
        daily_map[quota_day(event.created_at)].append(event)

    first_day = datetime.fromisoformat(quota_day(now)) - timedelta(days=days - 1)
    daily = []
    for offset in range(days):
        key = (first_day + timedelta(days=offset)).date().isoformat()
        daily.append({"date": key, **_totals(daily_map.get(key, []))})

    # ---- This user ----
    mine_today = [e for e in today if e.user_id == user.id]
    my_24h = user_messages_last_24h(db, user.id)
    mine_period = [e for e in events if e.user_id == user.id]

    result = {
        "generatedAt": iso(now),
        "quotaTimezone": settings.QUOTA_TIMEZONE,
        "resetsAt": iso(next_reset),
        "isAdmin": is_admin(user),
        "today": {
            **_totals(today),
            "avgLatencyMs": _avg(e.latency_ms for e in today if e.kind == "chat"),
            "avgFirstTokenMs": _avg(e.first_token_ms for e in today if e.kind == "chat"),
            "retries": sum(max(e.attempts - 1, 0) for e in today),
            "activeUsers": len({e.user_id for e in today if e.user_id}),
        },
        "models": models,
        "daily": daily,
        "me": {
            "messagesLast24h": my_24h,
            "dailyLimit": settings.RATE_LIMIT_PER_DAY,
            "remaining": max(settings.RATE_LIMIT_PER_DAY - my_24h, 0),
            "perMinuteLimit": settings.RATE_LIMIT_PER_MINUTE,
            "today": _totals(mine_today),
            "period": _totals(mine_period),
        },
        "period": {"days": days, **_totals(events)},
    }

    # ---- Admin-only detail ----
    if result["isAdmin"]:
        per_user: dict[str, list] = defaultdict(list)
        for event in events:
            if event.user_id:
                per_user[event.user_id].append(event)

        users = {u.id: u for u in db.query(User).filter(User.id.in_(list(per_user))).all()}
        result["users"] = sorted(
            (
                {
                    "email": users[uid].email if uid in users else "(deleted)",
                    "name": users[uid].name if uid in users else None,
                    **_totals(items),
                    "lastActive": iso(items[-1].created_at),
                }
                for uid, items in per_user.items()
            ),
            key=lambda row: row["totalTokens"],
            reverse=True,
        )[:25]

        recent = events[-25:][::-1]
        result["recent"] = [
            {
                "at": iso(e.created_at),
                "user": users[e.user_id].email if e.user_id in users else None,
                "kind": e.kind,
                "novaModel": e.nova_model,
                "geminiModel": e.gemini_model,
                "totalTokens": e.total_tokens,
                "latencyMs": e.latency_ms,
                "status": e.status,
            }
            for e in recent
        ]

    return result

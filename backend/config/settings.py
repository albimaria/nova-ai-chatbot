import hashlib
import hmac
import json
import logging
import os

from dotenv import load_dotenv


load_dotenv()

logger = logging.getLogger("nova.settings")


def _list(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


class Settings:
    APP_NAME = os.getenv("APP_NAME", "Nova AI Backend")
    APP_ENV = os.getenv("APP_ENV", "development")
    API_VERSION = os.getenv("API_VERSION", "v1")

    # Render sets RENDER=true automatically on its machines.
    IS_HOSTED = os.getenv("RENDER", "").lower() == "true"
    IS_PRODUCTION = APP_ENV == "production" or IS_HOSTED

    # ---------------- AI provider ----------------
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

    # Map the user-facing Nova models to real Gemini models.
    # Override any of them from the environment without code changes.
    MODEL_FAST = os.getenv("NOVA_MODEL_FAST", "gemini-3.5-flash-lite")
    # Flash-Lite answers in ~3s; Flash often takes 10-35s on the free tier, so it is
    # reserved for "Reasoning", where users expect to wait.
    MODEL_STANDARD = os.getenv("NOVA_MODEL_STANDARD", "gemini-3.5-flash-lite")
    MODEL_REASONING = os.getenv("NOVA_MODEL_REASONING", "gemini-3.5-flash")

    # Gemini thinking level per Nova model: MINIMAL, LOW, MEDIUM or HIGH.
    THINKING_FAST = os.getenv("NOVA_THINKING_FAST", "MINIMAL")
    THINKING_STANDARD = os.getenv("NOVA_THINKING_STANDARD", "LOW")
    THINKING_REASONING = os.getenv("NOVA_THINKING_REASONING", "HIGH")

    # Used when a mapped model is unavailable on this API key.
    MODEL_FALLBACK = os.getenv("NOVA_MODEL_FALLBACK", "gemini-3.5-flash-lite")

    # Model used for small housekeeping tasks such as chat titles.
    MODEL_UTILITY = os.getenv("NOVA_MODEL_UTILITY", "gemini-3.5-flash-lite")

    # Google Search grounding needs a paid Gemini plan; enable it when available.
    WEB_SEARCH_ENABLED = os.getenv("NOVA_WEB_SEARCH_ENABLED", "false").lower() == "true"

    DEFAULT_TEMPERATURE = _float("NOVA_DEFAULT_TEMPERATURE", 0.7)

    # How much earlier conversation is sent to the model.
    HISTORY_MAX_MESSAGES = _int("NOVA_HISTORY_MAX_MESSAGES", 30)
    HISTORY_MAX_CHARS = _int("NOVA_HISTORY_MAX_CHARS", 60000)

    # Gemini deletes uploaded files after 48 hours.
    FILE_TTL_HOURS = _int("NOVA_FILE_TTL_HOURS", 47)

    # ---------------- Database ----------------
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./nova.db")

    # ---------------- Auth ----------------
    JWT_SECRET = os.getenv("JWT_SECRET")
    JWT_ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = _int("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24 * 7)

    # ---------------- CORS ----------------
    CORS_ORIGINS = _list(
        os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,https://albimaria.github.io",
        )
    )

    # ---------------- Usage tracking ----------------
    # Emails (comma-separated) that can see the per-user usage breakdown.
    ADMIN_EMAILS = [e.lower() for e in _list(os.getenv("ADMIN_EMAILS", ""))]
    # SHA-256 of admin emails, so the owner is an admin without putting the
    # address itself in the public repository.
    ADMIN_EMAIL_HASHES = _list(
        os.getenv(
            "ADMIN_EMAIL_HASHES",
            "98d5ff7acc6287868f66d9f60770265b9593cce2cce4c25f330c18777bcea293",
        )
    )

    # Gemini API limits for this key, per model. Google doesn't expose remaining quota
    # through the API, so Nova counts its own calls against these numbers.
    # Check yours at https://aistudio.google.com/rate-limit and override with
    # NOVA_GEMINI_LIMITS='{"gemini-3.5-flash-lite": {"rpm": 15, "tpm": 250000, "rpd": 1000}}'
    GEMINI_LIMITS = {
        "gemini-3.5-flash-lite": {"rpm": 15, "tpm": 250000, "rpd": 1000},
        "gemini-3.5-flash": {"rpm": 10, "tpm": 250000, "rpd": 250},
    }
    # Gemini's daily quotas reset at midnight Pacific time.
    QUOTA_TIMEZONE = os.getenv("NOVA_QUOTA_TIMEZONE", "America/Los_Angeles")

    # ---------------- Rate limits (per user) ----------------
    RATE_LIMIT_PER_MINUTE = _int("NOVA_RATE_LIMIT_PER_MINUTE", 10)
    RATE_LIMIT_PER_DAY = _int("NOVA_RATE_LIMIT_PER_DAY", 200)
    # One-click demo accounts (for recruiters / visitors) get a smaller allowance.
    GUEST_ENABLED = os.getenv("NOVA_GUEST_ENABLED", "true").lower() == "true"
    GUEST_LIMIT_PER_DAY = _int("NOVA_GUEST_LIMIT_PER_DAY", 30)
    GUEST_SIGNUPS_PER_HOUR = _int("NOVA_GUEST_SIGNUPS_PER_HOUR", 10)
    UPLOAD_LIMIT_PER_HOUR = _int("NOVA_UPLOAD_LIMIT_PER_HOUR", 20)
    AUTH_LIMIT_PER_MINUTE = _int("NOVA_AUTH_LIMIT_PER_MINUTE", 10)

    def validate(self) -> None:
        overrides = os.getenv("NOVA_GEMINI_LIMITS")
        if overrides:
            try:
                self.GEMINI_LIMITS = {**self.GEMINI_LIMITS, **json.loads(overrides)}
            except ValueError:
                logger.warning("NOVA_GEMINI_LIMITS is not valid JSON; using defaults.")

        if not self.JWT_SECRET and self.IS_PRODUCTION and self.GEMINI_API_KEY:
            # Derive a stable secret from the (private) API key so logins survive
            # restarts. Setting JWT_SECRET explicitly is still recommended.
            logger.warning("JWT_SECRET is not set; deriving one from GEMINI_API_KEY.")
            self.JWT_SECRET = hmac.new(
                self.GEMINI_API_KEY.encode(), b"nova-jwt-signing-key", hashlib.sha256
            ).hexdigest()

        if not self.JWT_SECRET:
            if self.IS_PRODUCTION:
                raise RuntimeError(
                    "JWT_SECRET is not set. Generate one with "
                    "`python -c \"import secrets; print(secrets.token_urlsafe(48))\"` "
                    "and add it to the server's environment variables."
                )
            logger.warning(
                "JWT_SECRET is not set; using an insecure development secret."
            )
            self.JWT_SECRET = "nova-local-development-secret-do-not-use-in-production"

        if self.IS_PRODUCTION and self.DATABASE_URL.startswith("sqlite"):
            logger.warning(
                "DATABASE_URL points at SQLite on a hosted server. "
                "Data will be lost whenever the server restarts. "
                "Set DATABASE_URL to a PostgreSQL database."
            )

        if not self.GEMINI_API_KEY:
            logger.warning("GEMINI_API_KEY is not set; chat requests will fail.")


settings = Settings()
settings.validate()

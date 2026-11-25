from types import SimpleNamespace

from providers.gemini_provider import read_usage
from tests.test_api import send


def usage(client, auth):
    response = client.get("/api/v1/usage", headers=auth)
    assert response.status_code == 200, response.text
    return response.json()


def flash_lite(data):
    return next(m for m in data["models"] if m["model"] == "gemini-3.5-flash-lite")


def test_usage_counts_chat_and_title_calls(client, auth):
    before = usage(client, auth)
    send(client, auth)  # one chat call + one title call

    data = usage(client, auth)
    model = flash_lite(data)

    assert model["requestsToday"] - flash_lite(before)["requestsToday"] == 2
    assert model["remainingToday"] == model["rpdLimit"] - model["requestsToday"]
    assert data["me"]["messagesLast24h"] == 1
    assert data["me"]["remaining"] == data["me"]["dailyLimit"] - 1
    assert data["me"]["today"]["totalTokens"] == 175  # 150 chat + 25 title
    assert data["me"]["today"]["thinkingTokens"] == 10
    assert data["daily"][-1]["requests"] >= 2
    assert len(data["daily"]) == 30
    assert data["resetsAt"].endswith("Z")
    assert "users" not in data  # not an admin


def test_admin_sees_per_user_breakdown(client, auth, monkeypatch):
    from config.settings import settings

    send(client, auth)
    email = client.get("/auth/me", headers=auth).json()["email"]
    monkeypatch.setattr(settings, "ADMIN_EMAILS", [email])

    data = usage(client, auth)
    assert data["isAdmin"] is True
    assert any(row["email"] == email for row in data["users"])
    assert data["recent"][0]["kind"] in ("chat", "title")


def test_daily_limit_uses_database(client, auth, monkeypatch):
    from config.settings import settings

    monkeypatch.setattr(settings, "RATE_LIMIT_PER_DAY", 1)
    send(client, auth)

    response = client.post("/api/v1/chat/stream", json={"message": "again"}, headers=auth)
    assert response.status_code == 429
    assert "today" in response.json()["detail"]


def test_read_usage_from_gemini_metadata():
    chunk = SimpleNamespace(
        usage_metadata=SimpleNamespace(
            prompt_token_count=12,
            candidates_token_count=30,
            thoughts_token_count=8,
            total_token_count=50,
        )
    )
    assert read_usage(chunk) == {"input": 12, "output": 30, "thinking": 8, "total": 50}
    assert read_usage(SimpleNamespace(usage_metadata=None)) is None

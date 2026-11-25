import hashlib

from tests.test_api import send


def guest_headers(client):
    response = client.post("/auth/guest")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["is_guest"] is True
    assert data["email"].endswith("@guest.nova")
    return {"Authorization": f"Bearer {data['access_token']}"}


def test_guest_can_chat_with_smaller_limit(client, monkeypatch):
    from config.settings import settings

    monkeypatch.setattr(settings, "GUEST_LIMIT_PER_DAY", 1)
    headers = guest_headers(client)

    assert client.get("/auth/me", headers=headers).json()["is_guest"] is True
    send(client, headers)

    usage = client.get("/api/v1/usage", headers=headers).json()
    assert usage["me"]["isGuest"] is True
    assert usage["me"]["dailyLimit"] == 1
    assert usage["me"]["remaining"] == 0

    blocked = client.post("/api/v1/chat/stream", json={"message": "again"}, headers=headers)
    assert blocked.status_code == 429


def test_guest_can_delete_itself_without_password(client):
    headers = guest_headers(client)
    response = client.request("DELETE", "/auth/me", json={"password": ""}, headers=headers)
    assert response.status_code == 200


def test_guest_signups_are_rate_limited(client, monkeypatch):
    from config.settings import settings

    monkeypatch.setattr(settings, "GUEST_SIGNUPS_PER_HOUR", 2)
    assert client.post("/auth/guest").status_code == 200
    assert client.post("/auth/guest").status_code == 200
    assert client.post("/auth/guest").status_code == 429


def test_admin_by_email_hash(client, auth, monkeypatch):
    from config.settings import settings

    email = client.get("/auth/me", headers=auth).json()["email"]
    monkeypatch.setattr(settings, "ADMIN_EMAILS", [])
    monkeypatch.setattr(
        settings, "ADMIN_EMAIL_HASHES", [hashlib.sha256(email.encode()).hexdigest()]
    )

    assert client.get("/api/v1/usage", headers=auth).json()["isAdmin"] is True

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


def test_guest_can_save_chats_by_creating_an_account(client):
    headers = guest_headers(client)
    conversation_id = send(client, headers)[0][1]["conversationId"]

    response = client.post(
        "/auth/claim",
        json={"email": "Recruiter@Example.com", "password": "password123", "name": "Riya"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["is_guest"] is False

    # Sign out and back in with the new credentials: the demo chat is still there.
    login = client.post("/auth/login", json={"email": "recruiter@example.com", "password": "password123"})
    assert login.status_code == 200
    new_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    conversations = client.get("/api/v1/conversations", headers=new_headers).json()
    assert [c["id"] for c in conversations] == [conversation_id]
    assert client.get("/auth/me", headers=new_headers).json()["name"] == "Riya"


def test_claim_rules(client, auth):
    # Registered accounts can't claim.
    assert client.post(
        "/auth/claim", json={"email": "x@example.com", "password": "password123"}, headers=auth
    ).status_code == 400

    # Can't take an email that is already used.
    taken = client.get("/auth/me", headers=auth).json()["email"]
    headers = guest_headers(client)
    response = client.post(
        "/auth/claim", json={"email": taken, "password": "password123"}, headers=headers
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

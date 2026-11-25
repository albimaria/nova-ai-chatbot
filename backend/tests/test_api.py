import io
import json
import zipfile

from rate_limit import limiter


def parse_sse(text):
    events = []

    for block in text.strip().split("\n\n"):
        event, data = "message", ""

        for line in block.split("\n"):
            if line.startswith("event:"):
                event = line[6:].strip()
            elif line.startswith("data:"):
                data += line[5:].strip()

        events.append((event, json.loads(data)))

    return events


def send(client, auth, **body):
    response = client.post(
        "/api/v1/chat/stream", json={"message": "Hi", **body}, headers=auth
    )
    assert response.status_code == 200, response.text
    return parse_sse(response.text)


def messages_of(client, auth, conversation_id):
    response = client.get(f"/api/v1/conversations/{conversation_id}", headers=auth)
    return response.json()["messages"]


def test_requires_login(client):
    assert client.get("/api/v1/conversations").status_code == 401
    assert client.post("/api/v1/files/upload").status_code == 401


def test_login_and_me(client, auth):
    me = client.get("/auth/me", headers=auth).json()
    assert me["name"] == "Asha"

    bad = client.post("/auth/login", json={"email": me["email"], "password": "wrong-pass"})
    assert bad.status_code == 401


def test_stream_creates_conversation_and_saves_reply(client, auth, fake_stream):
    events = send(client, auth)
    kinds = [e for e, _ in events]
    assert kinds[0] == "start" and kinds[-1] == "done"

    text = "".join(d["text"] for e, d in events if e == "delta")
    assert text == fake_stream.reply  # newlines and backslashes survive intact

    done = events[-1][1]
    assert done["title"] == "Greeting Nova"

    messages = messages_of(client, auth, done["conversationId"])
    assert [m["role"] for m in messages] == ["user", "assistant"]
    assert messages[1]["content"] == fake_stream.reply

    system = fake_stream.calls[0]["system"]
    assert "Nova" in system and "Asha" in system


def test_history_comes_from_server(client, auth, fake_stream):
    conversation_id = send(client, auth)[0][1]["conversationId"]
    send(client, auth, message="Second", conversation_id=conversation_id)

    turns = fake_stream.calls[-1]["turns"]
    assert [t.role for t in turns] == ["user", "assistant", "user"]
    assert turns[-1].text == "Second"


def test_cannot_access_other_users_conversation(client, auth):
    conversation_id = send(client, auth)[0][1]["conversationId"]

    other = client.post(
        "/auth/signup", json={"email": "intruder@example.com", "password": "password123"}
    ).json()
    headers = {"Authorization": f"Bearer {other['access_token']}"}

    response = client.get(f"/api/v1/conversations/{conversation_id}", headers=headers)
    assert response.status_code == 404

    response = client.post(
        "/api/v1/chat/stream",
        json={"message": "x", "conversation_id": conversation_id},
        headers=headers,
    )
    assert response.status_code == 404


def test_edit_removes_later_messages(client, auth):
    start = send(client, auth)[0][1]
    conversation_id = start["conversationId"]
    send(client, auth, message="Follow up", conversation_id=conversation_id)

    response = client.post(
        f"/api/v1/chat/messages/{start['userMessageId']}/edit",
        json={"content": "Edited"},
        headers=auth,
    )
    assert response.status_code == 200

    messages = messages_of(client, auth, conversation_id)
    assert messages[0]["content"] == "Edited"
    assert len(messages) == 2


def test_regenerate_from_assistant_message(client, auth):
    events = send(client, auth)
    assistant_id = events[-1][1]["assistantMessageId"]
    conversation_id = events[0][1]["conversationId"]

    response = client.post(
        f"/api/v1/chat/messages/{assistant_id}/regenerate", json={}, headers=auth
    )
    new_events = parse_sse(response.text)
    assert new_events[-1][0] == "done"

    messages = messages_of(client, auth, conversation_id)
    assert len(messages) == 2
    assert messages[1]["id"] == new_events[-1][1]["assistantMessageId"]


def test_feedback_pin_rename_share(client, auth):
    events = send(client, auth, web_search=True)
    assistant_id = events[-1][1]["assistantMessageId"]
    conversation_id = events[0][1]["conversationId"]
    assert any(e == "sources" for e, _ in events)

    r = client.put(
        f"/api/v1/chat/messages/{assistant_id}/feedback",
        json={"feedback": "up"},
        headers=auth,
    )
    assert r.json()["feedback"] == "up"

    r = client.patch(
        f"/api/v1/conversations/{conversation_id}",
        json={"title": "Renamed", "pinned": True},
        headers=auth,
    )
    assert r.json()["title"] == "Renamed" and r.json()["pinned"] is True

    token = client.post(
        f"/api/v1/conversations/{conversation_id}/share", headers=auth
    ).json()["shareToken"]

    shared = client.get(f"/api/v1/shared/{token}").json()
    assert shared["title"] == "Renamed"
    assert shared["messages"][1]["sources"][0]["url"] == "https://example.com"
    assert "feedback" not in shared["messages"][1]

    client.delete(f"/api/v1/conversations/{conversation_id}/share", headers=auth)
    assert client.get(f"/api/v1/shared/{token}").status_code == 404


def test_rate_limit(client, auth, monkeypatch):
    from config.settings import settings

    monkeypatch.setattr(settings, "RATE_LIMIT_PER_MINUTE", 2)
    limiter.reset()

    send(client, auth)
    send(client, auth)

    response = client.post("/api/v1/chat/stream", json={"message": "Hi"}, headers=auth)
    assert response.status_code == 429


def test_delete_account(client, auth):
    send(client, auth)

    r = client.request("DELETE", "/auth/me", json={"password": "password123"}, headers=auth)
    assert r.status_code == 200
    assert client.get("/auth/me", headers=auth).status_code == 401


def test_docx_to_text():
    from routes.files import docx_to_text

    xml = (
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p>"
        "<w:p><w:r><w:t>World</w:t></w:r></w:p></w:body></w:document>"
    )

    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("word/document.xml", xml)

    assert docx_to_text(buffer.getvalue()) == "Hello\nWorld"

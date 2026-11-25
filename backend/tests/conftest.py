import os
import sys
import tempfile
from pathlib import Path

import pytest

_db_dir = tempfile.mkdtemp()
# Set TEST_DATABASE_URL to run the suite against PostgreSQL instead of SQLite.
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{_db_dir}/test.db"
os.environ["JWT_SECRET"] = "test-secret-for-pytest-only-0123456789abcdef"
os.environ["GEMINI_API_KEY"] = "test-key"
os.environ["NOVA_WEB_SEARCH_ENABLED"] = "true"
os.environ.pop("RENDER", None)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from providers import gemini_provider  # noqa: E402
from rate_limit import limiter  # noqa: E402


REPLY = "Hello! I'm **Nova**.\nLine two with a literal \\n escape."


class FakeStream:
    def __init__(self, reply=REPLY):
        self.reply = reply
        self.calls = []

    def __call__(self, turns, nova_model, system_prompt, temperature=None, web_search=False, meta=None):
        if meta is not None:
            meta.update(
                gemini_model="gemini-3.5-flash-lite",
                attempts=1,
                first_token_ms=120,
                usage={"input": 100, "output": 40, "thinking": 10, "total": 150},
            )

        self.calls.append(
            {"turns": turns, "model": nova_model, "system": system_prompt, "web": web_search}
        )

        for piece in (self.reply[:10], self.reply[10:]):
            yield gemini_provider.StreamEvent("text", piece)

        if web_search:
            yield gemini_provider.StreamEvent(
                "sources", [{"url": "https://example.com", "title": "Example"}]
            )


@pytest.fixture
def fake_stream(monkeypatch):
    fake = FakeStream()
    monkeypatch.setattr(gemini_provider, "stream_reply", fake)
    def fake_title(*_args, meta=None):
        if meta is not None:
            meta.update(gemini_model="gemini-3.5-flash-lite", usage={"input": 20, "output": 5, "thinking": 0, "total": 25})
        return "Greeting Nova"

    monkeypatch.setattr(gemini_provider, "generate_title", fake_title)
    return fake


@pytest.fixture
def client(fake_stream):
    limiter.reset()

    with TestClient(main.app) as test_client:
        yield test_client


_counter = {"n": 0}


@pytest.fixture
def auth(client):
    _counter["n"] += 1
    response = client.post(
        "/auth/signup",
        json={
            "email": f"user{_counter['n']}@example.com",
            "password": "password123",
            "name": "Asha",
        },
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

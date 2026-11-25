from types import SimpleNamespace

from google.genai import errors as genai_errors

from providers import gemini_provider as provider
from providers.gemini_provider import Turn


def overloaded():
    return genai_errors.ServerError(
        503, {"error": {"code": 503, "message": "high demand", "status": "UNAVAILABLE"}}
    )


class FakeModels:
    def __init__(self, failures):
        self.failures = failures
        self.calls = []

    def generate_content_stream(self, model, contents, config):
        self.calls.append((model, getattr(config.thinking_config, "thinking_level", None)))

        if len(self.calls) <= self.failures:
            raise overloaded()

        return iter([SimpleNamespace(text="Hello", candidates=None)])


class MidStreamFailure(FakeModels):
    def generate_content_stream(self, model, contents, config):
        self.calls.append((model, None))

        if len(self.calls) == 1:
            def broken():
                yield SimpleNamespace(text="Half an ans", candidates=None)
                raise overloaded()

            return broken()

        return iter([SimpleNamespace(text="Full answer", candidates=None)])


def test_mid_stream_failure_resets_and_retries(monkeypatch):
    models = MidStreamFailure(failures=0)
    monkeypatch.setattr(provider, "get_client", lambda: SimpleNamespace(models=models))
    monkeypatch.setattr(provider.time, "sleep", lambda _seconds: None)

    events = list(provider.stream_reply([Turn("user", "hi")], "Nova Standard", "system"))
    assert [(e.kind, e.value) for e in events] == [
        ("text", "Half an ans"),
        ("reset", None),
        ("text", "Full answer"),
    ]


def test_requests_have_a_deadline():
    config = provider._config("system", 0.7, False, "LOW")
    assert config.http_options.timeout == provider.TIMEOUT_MS
    assert provider._config("system", 0.7, False, "HIGH").http_options.timeout == provider.TIMEOUT_HIGH_THINKING_MS


def run(monkeypatch, failures):
    models = FakeModels(failures)
    monkeypatch.setattr(provider, "get_client", lambda: SimpleNamespace(models=models))
    monkeypatch.setattr(provider.time, "sleep", lambda _seconds: None)
    events = list(provider.stream_reply([Turn("user", "hi")], "Nova Reasoning", "system"))
    return models, events


def test_retries_overloaded_model_then_succeeds(monkeypatch):
    models, events = run(monkeypatch, failures=2)
    assert [e.value for e in events] == ["Hello"]
    assert len(models.calls) == 3
    # First attempt uses the Reasoning model, retries use the fast fallback.
    assert models.calls[1][0] == provider.settings.MODEL_FALLBACK


def test_gives_up_after_all_attempts(monkeypatch):
    try:
        run(monkeypatch, failures=10)
    except genai_errors.ServerError as error:
        assert error.code == 503
        assert "busy" in provider.friendly_error(error)
    else:
        raise AssertionError("expected the overload error to surface")


def test_identity_prompt_includes_custom_instructions():
    prompt = provider.build_system_prompt("Asha", "Answer briefly.")
    assert "You are Nova" in prompt
    assert "Asha" in prompt
    assert "Answer briefly." in prompt

import logging
import time
from datetime import datetime
from datetime import timezone
from typing import Iterator

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from config.settings import settings


logger = logging.getLogger("nova.gemini")

_client: genai.Client | None = None


def get_client() -> genai.Client:
    global _client

    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)

    return _client


# ------------------------------------------------------------
# Models
# ------------------------------------------------------------

# Nova model -> (Gemini model, thinking level)
NOVA_MODELS = {
    "Nova Fast": lambda: (settings.MODEL_FAST, settings.THINKING_FAST),
    "Nova Standard": lambda: (settings.MODEL_STANDARD, settings.THINKING_STANDARD),
    "Nova Reasoning": lambda: (settings.MODEL_REASONING, settings.THINKING_REASONING),
}

DEFAULT_NOVA_MODEL = "Nova Standard"


def resolve_model(nova_model: str | None) -> tuple[str, str]:
    return NOVA_MODELS.get(nova_model or "", NOVA_MODELS[DEFAULT_NOVA_MODEL])()


# ------------------------------------------------------------
# System prompt
# ------------------------------------------------------------

BASE_SYSTEM_PROMPT = """You are Nova, a helpful, honest and friendly AI assistant.

Identity:
- Your name is Nova. If asked who you are, say you are Nova, an AI assistant.
- Do not claim to be made by Google, OpenAI, Anthropic or any other company, and
  do not call yourself Gemini, ChatGPT or Claude.
- If someone asks which underlying model powers you, say Nova runs on a large
  language model provided through a third-party API.

How to answer:
- Be clear and direct. Lead with the answer, then explain only as much as helps.
- Use Markdown: headings for long answers, bullet lists, tables when comparing,
  and fenced code blocks with a language tag (for example ```python).
- Write math with LaTeX: $inline$ and $$block$$.
- If you are unsure or something may be out of date, say so instead of guessing.
- Refuse clearly harmful requests briefly and politely, and offer a safer
  alternative when one exists.

Today's date is {today}."""


def build_system_prompt(user_name: str | None, custom_instructions: str | None) -> str:
    today = datetime.now(timezone.utc).strftime("%A, %d %B %Y")
    prompt = BASE_SYSTEM_PROMPT.format(today=today)

    if user_name:
        prompt += f"\n\nThe user's name is {user_name}."

    if custom_instructions:
        prompt += (
            "\n\nThe user has given these custom instructions. Follow them unless "
            "they conflict with the rules above:\n"
            f"<custom_instructions>\n{custom_instructions}\n</custom_instructions>"
        )

    return prompt


# ------------------------------------------------------------
# Contents
# ------------------------------------------------------------

class Turn:
    """One message to send to the model."""

    def __init__(self, role: str, text: str, files: list[tuple[str, str]] | None = None):
        self.role = role
        self.text = text
        # list of (uri, mime_type)
        self.files = files or []


def build_contents(turns: list[Turn]) -> list[types.Content]:
    contents: list[types.Content] = []

    for turn in turns:
        parts = [
            types.Part.from_uri(file_uri=uri, mime_type=mime)
            for uri, mime in turn.files
        ]

        if turn.text.strip():
            parts.append(types.Part.from_text(text=turn.text))

        if not parts:
            continue

        role = "model" if turn.role == "assistant" else "user"

        # Gemini expects alternating roles; merge consecutive same-role turns.
        if contents and contents[-1].role == role:
            contents[-1].parts.extend(parts)
        else:
            contents.append(types.Content(role=role, parts=parts))

    return contents


# ------------------------------------------------------------
# Errors
# ------------------------------------------------------------

def _error_code(error: Exception) -> int | None:
    code = getattr(error, "code", None)
    return code if isinstance(code, int) else None


def is_model_unavailable(error: Exception) -> bool:
    """Missing model, no quota, or temporarily overloaded: retry on the fallback model."""
    text = str(error)
    code = _error_code(error)
    return (
        code in (404, 429, 500, 502, 503, 504)
        or "NOT_FOUND" in text
        or "RESOURCE_EXHAUSTED" in text
        or "UNAVAILABLE" in text
    )


def friendly_error(error: Exception) -> str:
    code = _error_code(error)
    text = str(error)

    if code == 429 or "RESOURCE_EXHAUSTED" in text or "quota" in text.lower():
        return (
            "Nova is getting a lot of requests right now and hit its usage limit. "
            "Please try again in a minute."
        )

    if code in (401, 403) or "PERMISSION_DENIED" in text or "UNAUTHENTICATED" in text:
        if "file" in text.lower():
            return (
                "An attached file is no longer available (files expire after 48 hours). "
                "Please upload it again."
            )
        return "Nova could not reach its AI service. Please try again later."

    if code == 400 or "INVALID_ARGUMENT" in text:
        return "Nova couldn't process that message or file. Please check it and try again."

    if code == 404 or "NOT_FOUND" in text:
        return "The selected model is currently unavailable. Try another Nova model."

    if code in (500, 502, 503, 504) or "UNAVAILABLE" in text or "DEADLINE" in text:
        return "The AI service is busy or timed out. Please try again."

    return "Nova couldn't generate a response right now. Please try again."


# ------------------------------------------------------------
# Generation
# ------------------------------------------------------------

class StreamEvent:
    def __init__(self, kind: str, value):
        self.kind = kind  # "text" | "sources" | "notice"
        self.value = value


def _config(system_prompt: str, temperature: float, web_search: bool, thinking: str | None):
    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=max(0.0, min(2.0, temperature)),
    )

    if thinking:
        config.thinking_config = types.ThinkingConfig(thinking_level=thinking.upper())

    if web_search:
        config.tools = [types.Tool(google_search=types.GoogleSearch())]

    return config


def _extract_sources(chunk, seen: dict) -> None:
    for candidate in getattr(chunk, "candidates", None) or []:
        metadata = getattr(candidate, "grounding_metadata", None)

        for item in getattr(metadata, "grounding_chunks", None) or []:
            web = getattr(item, "web", None)
            uri = getattr(web, "uri", None)

            if uri and uri not in seen:
                seen[uri] = getattr(web, "title", None) or uri


def stream_reply(
    turns: list[Turn],
    nova_model: str,
    system_prompt: str,
    temperature: float | None = None,
    web_search: bool = False,
    meta: dict | None = None,
) -> Iterator[StreamEvent]:
    """Yield text chunks, then a final sources event if web search was used.

    `meta` (optional) is filled with what happened, for usage tracking:
    gemini_model, attempts, usage (token counts from Gemini), first_token_ms, error_code.
    """

    meta = meta if meta is not None else {}
    started = time.monotonic()

    client = get_client()
    contents = build_contents(turns)
    model, thinking = resolve_model(nova_model)
    temperature = settings.DEFAULT_TEMPERATURE if temperature is None else temperature

    # (model, thinking level, web search) attempts, in order.
    candidates = [(model, thinking, web_search)]

    if web_search:
        candidates.append((model, thinking, False))

    if settings.MODEL_FALLBACK:
        # Gemini's 503 "high demand" spikes are usually momentary, so retry the fast
        # fallback model twice with a short backoff before giving up.
        candidates.append((settings.MODEL_FALLBACK, "MINIMAL", False))
        candidates.append((settings.MODEL_FALLBACK, "MINIMAL", False))

    retries = 0

    sources: dict[str, str] = {}

    for index, (candidate, level, search) in enumerate(candidates):
        produced = False
        config = _config(system_prompt, temperature, search, level)
        meta["gemini_model"] = candidate
        meta["attempts"] = index + 1

        try:
            logger.info("Generating with %s/%s (%s)", candidate, level, nova_model)
            stream = client.models.generate_content_stream(
                model=candidate, contents=contents, config=config
            )

            for chunk in stream:
                if search:
                    _extract_sources(chunk, sources)

                usage = read_usage(chunk)
                if usage:
                    meta["usage"] = usage

                text = getattr(chunk, "text", None)

                if text:
                    if not produced:
                        meta["first_token_ms"] = int((time.monotonic() - started) * 1000)
                    produced = True
                    yield StreamEvent("text", text)

            meta.pop("error_code", None)
            break

        except genai_errors.APIError as error:
            last = index == len(candidates) - 1
            meta["error_code"] = _error_code(error)

            if not produced and not last and is_model_unavailable(error):
                logger.warning("Model %s unavailable (%s), falling back", candidate, error)

                if _error_code(error) in (429, 500, 502, 503, 504):
                    retries += 1
                    time.sleep(retries)

                if search:
                    yield StreamEvent(
                        "notice", "Web search isn't available right now, so Nova answered without it."
                    )

                continue

            raise

    if sources:
        yield StreamEvent(
            "sources", [{"url": url, "title": title} for url, title in sources.items()]
        )


def read_usage(response) -> dict | None:
    """Token counts Gemini reports in `usage_metadata` (streamed chunks carry running totals)."""

    metadata = getattr(response, "usage_metadata", None)

    if not metadata:
        return None

    def value(name):
        number = getattr(metadata, name, None)
        return int(number) if isinstance(number, (int, float)) else 0

    usage = {
        "input": value("prompt_token_count"),
        "output": value("candidates_token_count"),
        "thinking": value("thoughts_token_count"),
        "total": value("total_token_count"),
    }

    if not usage["total"]:
        usage["total"] = usage["input"] + usage["output"] + usage["thinking"]

    return usage if usage["total"] else None


def generate_title(user_message: str, reply: str, meta: dict | None = None) -> str | None:
    prompt = (
        "Write a short title (2 to 6 words) for a conversation that starts with the "
        "message below. Reply with the title only: no quotes, no punctuation at the end.\n\n"
        f"User: {user_message[:1500]}\n\nAssistant: {reply[:1500]}"
    )

    try:
        response = get_client().models.generate_content(
            model=settings.MODEL_UTILITY,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=40,
                thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),
            ),
        )
        if meta is not None:
            meta["usage"] = read_usage(response)
            meta["gemini_model"] = settings.MODEL_UTILITY

        title = (response.text or "").strip().strip("\"'#*").strip()
        title = title.splitlines()[0] if title else ""
        return title[:80] or None

    except Exception as error:  # Title generation must never break chat.
        logger.warning("Title generation failed: %s", error)
        if meta is not None:
            meta["gemini_model"] = settings.MODEL_UTILITY
            meta["error_code"] = _error_code(error) or 0
        return None


# ------------------------------------------------------------
# Files
# ------------------------------------------------------------

def upload_file(path: str, mime_type: str, display_name: str):
    return get_client().files.upload(
        file=path, config={"mime_type": mime_type, "display_name": display_name}
    )


def get_file(name: str):
    return get_client().files.get(name=name)

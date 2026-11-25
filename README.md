# Nova — AI chatbot

Nova is a full-stack AI assistant in the spirit of ChatGPT and Claude: a React frontend
with a 3D glass interface and a FastAPI backend that streams replies from Google Gemini.

**Live:** https://albimaria.github.io/nova-ai-chatbot/

## Features

- **Streaming chat** over Server-Sent Events, with Stop (partial replies are kept)
- **Three models**: Nova Fast, Standard and Reasoning (mapped to Gemini models + thinking levels)
- **Nova's own identity**: system prompt, the user's name and **custom instructions**
- **Files**: PDF, images, Word (.docx), text and code; drag and drop or paste
- **Edit & regenerate** (later messages are replaced), **like/dislike** feedback saved to the server
- **Auto-generated chat titles**, rename, **pin**, search, delete, delete all
- **Share links**: public read-only page for a chat, can be revoked
- **Markdown** with tables, syntax-highlighted code (copy button) and LaTeX math
- **Voice**: dictate messages, read replies aloud (browser speech APIs)
- **Accounts**: sign up / log in (JWT), change password, export data, delete account
- **3D UI**: React Three Fiber scene that reacts while Nova is thinking, glass panels,
  tilt cards, dark / light / system themes, motion toggle, mobile layout, keyboard shortcuts
- **Usage tracker**: live dashboard (sidebar → chart icon) with Gemini requests left today,
  per-model daily / per-minute / token-per-minute meters, tokens per day, your own message
  allowance, response times and errors. Token counts come straight from Gemini's
  `usage_metadata`; admins also see per-user usage and recent requests
- **Production basics**: per-user rate limits, Alembic migrations, PostgreSQL support,
  friendly error messages, model fallback on overload, tests + CI

## Project structure

```
backend/                 FastAPI app
  main.py                app, CORS, startup migrations
  config/settings.py     all configuration (env vars)
  auth.py, rate_limit.py
  routes/                auth, chat (streaming), conversations (+ sharing), files
  services/chat_service  conversation flow, context building, streaming + saving
  providers/             Gemini client, system prompt, model mapping, errors
  migrations/            Alembic migrations (run automatically on startup)
  tests/                 pytest suite (Gemini is mocked)
src/                     React app (Vite)
  api/client.js          API calls + SSE stream reader
  hooks/useChat.js       messages, streaming, edit/regenerate/stop
  components/            auth, chat, layout, settings, share, three (3D scene), ui
  styles/app.css         design system
```

## Run locally

**Backend** (Python 3.11+):

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env           # then fill in GEMINI_API_KEY
uvicorn main:app --reload --port 8000
```

**Frontend** (Node 22):

```bash
npm install
npm run dev                      # http://localhost:5173/nova-ai-chatbot/
```

In development the frontend talks to `http://localhost:8000`. Set `VITE_API_URL` to point it elsewhere.

## Tests

```bash
cd backend && python -m pytest -q     # API tests, no real Gemini calls
npm run lint && npm run build         # frontend checks
```

CI runs both on every push and pull request (`.github/workflows/ci.yml`).

## Deploy

**Frontend** — pushing to `main` builds and deploys to GitHub Pages (`deploy.yml`).

**Backend (Render)** — set these environment variables on the service:

| Variable | Required | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | Google AI Studio key |
| `JWT_SECRET` | recommended | `python -c "import secrets; print(secrets.token_urlsafe(48))"`. If unset on Render, a stable secret is derived from `GEMINI_API_KEY` |
| `DATABASE_URL` | yes | PostgreSQL URL. Recommended: a free [Neon](https://neon.tech) project (pooled connection string). Render's free Postgres expires after 30 days, and SQLite on Render is wiped on every restart. Check `/health`: `"database": "postgresql"` means it is in use |
| `CORS_ORIGINS` | no | Defaults to localhost + `https://albimaria.github.io` |
| `NOVA_RATE_LIMIT_PER_MINUTE` / `_PER_DAY` | no | Defaults 10 / 200 per user |
| `NOVA_MODEL_FAST` / `_STANDARD` / `_REASONING` | no | Override the Gemini model behind each Nova model |
| `ADMIN_EMAILS` | no | Comma-separated emails that see the per-user usage breakdown |
| `NOVA_GEMINI_LIMITS` | no | JSON of your key's limits per model, e.g. `{"gemini-3.5-flash-lite": {"rpm": 15, "tpm": 250000, "rpd": 1000}}` (see aistudio.google.com/rate-limit) |
| `NOVA_WEB_SEARCH_ENABLED` | no | `true` shows a web-search toggle (needs a paid Gemini plan) |

Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`. Database migrations run automatically on startup.

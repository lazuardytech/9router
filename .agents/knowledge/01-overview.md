# Overview

**9router** = internal Lazuardy Tech LLM proxy/router. Forked from [decolua/9router](https://github.com/decolua/9router).

## Core Functionality
OpenAI/Anthropic/Gemini/Ollama-compatible HTTP proxy. Supports:
- Fanning requests to multiple providers (Claude-code, Codex, Gemini-CLI, Kiro, Cursor, Vertex, OpenRouter, DeepSeek, etc.)
- Automatic fallback, account rotation, format translation, SSE streaming.
- Next.js dashboard for account/API key management, usage, and MITM control.

## Tech Stack
- **Next.js 16 + React 19**
- **Pure JavaScript ESM** (no TS)
- **Tailwind v4**
- **Package Manager**: pnpm (hoisted linker)
- **Runtime**: Node.js or Bun
- **Storage**: SQLite via `better-sqlite3` (Node) or `bun:sqlite` (Bun). Legacy `db.json` auto-migrated.

## Repo Structure
| Dir | Purpose |
|---|---|
| `src/` | Next.js UI + API routes + server libs |
| `open-sse/` | Router engine (executors, translators, handlers) — local package |
| `cloud/` | Cloudflare Worker companion |
| `skills/` | AI agent SKILL.md specs |
| `tests/` | Vitest tests |

## Conventions
- Internally keep "9router" naming (package name, env vars, data dir `~/.9router/`).
- JSDoc for types.
- No new dependencies without checking current usage.
- Run `pnpm exec eslint .` and `pnpm run test:run` before push.

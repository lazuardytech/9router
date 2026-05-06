# Overview

**melma-router** = internal Lazuardy Tech LLM proxy/router. Forked/inspired by [decolua/9router](https://github.com/decolua/9router) (the upstream is itself a JS port of CLIProxyAPI).

## What it does

OpenAI/Anthropic/Gemini/Ollama-compatible HTTP proxy that fans out client requests to many LLM providers (claude-code, codex, gemini-cli, kiro, cursor, vertex, openrouter, deepseek, …) with automatic fallback, account rotation, format translation, and SSE streaming.

Ships with a Next.js dashboard for managing accounts, combos, API keys, usage, MITM, and an Cloudflare Worker companion (`cloud/`) for cloud sync.

## Stack

- **Next.js 16** (App Router, webpack bundler) + **React 19**
- **Pure JavaScript ESM** (no TS — JSDoc only). Path aliases via `jsconfig.json`.
- **Tailwind v4** (CSS-config), Monaco editor, recharts, @xyflow/react, zustand
- **Package manager**: **pnpm** (migrated from npm). Config: `.npmrc` with `node-linker=hoisted`. `paseo.json` for Paseo worktree.
- **Storage**: **SQLite** (`~/.9router/9router.sqlite`) via `better-sqlite3` (Node) or `bun:sqlite` (Bun). Legacy `db.json` auto-migrated on first boot. Cloudflare Workers branch uses in-memory lowdb stub.
- **Streaming**: Web Streams API + `open-sse/` local package (the actual router engine)
- **Runtime**: Node or Bun (`dev:bun`, `start:bun`); production Docker uses Bun

## Repo structure (top-level)

| Dir | Purpose |
|---|---|
| `src/` | Next.js app (UI + API routes + server libs) |
| `open-sse/` | LLM router engine (provider configs, executors, translators, RTK, handlers) — local package, NOT npm dep |
| `cloud/` | Standalone Cloudflare Worker companion (D1, KV) |
| `skills/` | Markdown SKILL.md files for AI agents (raw-served from GitHub) |
| `tests/` | Vitest unit tests (managed via root `vitest.config.mjs`, deps via pnpm) |
| `tester/` | Manual translator harness |
| `docs/` | `ARCHITECTURE.md` (557 lines, authoritative) |
| `i18n/` | README translations (ja, vi, zh-CN) |
| `public/` | Static assets + `i18n/literals/` runtime locale JSON |
| `scripts/` | One-off scripts incl. `migrate-json-to-sqlite.mjs` + README translator |
| `.github/workflows/` | Docker publish + CI workflows |

## Naming note

Internally code still says **"9router"** (package name `9router-app`, data dir `~/.9router/`, env vars, skills repo `decolua/9router`, `NINEROUTER_*` env). The "melma-router" name is only the GitHub repo + README. Don't blanket-rename without coordination.

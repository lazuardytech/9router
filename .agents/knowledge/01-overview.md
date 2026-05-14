# Overview

9router is Lazuardy Tech's internal AI routing proxy built on a customized 9router codebase.

Current baseline in this repo: **v0.3.1**.

## Core Capabilities

- OpenAI-compatible and Anthropic-compatible gateway endpoints under `/v1/*`
- Multi-provider routing with account fallback and format translation
- Streaming + non-streaming handling through `open-sse`
- Semantic response cache
- Conversational memory injection/extraction
- API key auth with optional per-key rate limit:
  - `unlimited`
  - `limited` (`requestsPerMinute`, `concurrentRequests`)

## Dashboard Information Architecture

- API: Endpoint, LLM Providers, Media Providers, Combos, Memory, Cache
- Analytics: Usage, Quota
- System: Proxy Pools, Console Log, Settings

## Tech Stack

- Next.js 16 + React 19
- Pure JavaScript (ESM style)
- Tailwind CSS v4
- pnpm as package manager
- SQLite (`better-sqlite3` on Node, `bun:sqlite` on Bun path)

## Repository Layout

| Dir | Purpose |
|---|---|
| `src/` | Next.js app UI and API routes |
| `open-sse/` | Core router/translator/executor engine |
| `cloud/` | Cloud companion code |
| `tests/` | Unit and integration tests |
| `.agents/` | Agent-oriented project knowledge |

## Ground Rules

- Keep internal naming as `9router` (package/data/env conventions).
- Use `pnpm` for all install/build/test workflows.
- Validate with `pnpm run test:run` and `pnpm run build` before release/tag.

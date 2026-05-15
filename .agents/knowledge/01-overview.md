# Overview

Pod is Lazuardy Tech's internal AI routing proxy built on a customized pod codebase.

Current baseline in this repo: **v0.0.1**.

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

- API: Endpoint, Providers, Media Providers, Combos
- Analytics: Usage & Analytics, Quota Tracker
- System: Proxy Pools, Logs, Settings, Health

## Tech Stack

- Next.js 16 + React 19
- Pure JavaScript (ESM style)
- Tailwind CSS v4
- bun (v1.3.14) as package manager
- SQLite (`better-sqlite3` on Node, `bun:sqlite` on Bun path)

## Repository Layout

| Dir | Purpose |
|---|---|
| `src/` | Next.js app UI and API routes |
| `open-sse/` | Core router/translator/executor engine |
| `cloud/` | Cloud companion code |
| `tests/` | Unit and integration tests |
| `.agents/` | Agent-oriented project knowledge |

## New Features (v0.0.1)

- `/health` page — System Health with TelemetryCard sparklines, DB health, Provider Health card, Rate Limit Status card
- `/logs` page — multi-tab: Request Logs, Proxy Logs, Console Logs
- API Keys table on endpoint page (max 15 rows, pagination, edit/remove)
- Sidebar collapse with icon-only mode
- Light/dark/system theme switcher
- Favicon from RealFaviconGenerator
- Custom SVG logo in sidebar and login page
- Login page: `Pod • Login` tab title, disabled button on loading
- Settings page rewritten with Linear design system

## Ground Rules

- Keep internal naming as `pod` (package/data/env conventions).
- Use `bun` for all install/build/test workflows.
- Validate with `bun run test:run` and `bun run build` before release/tag.

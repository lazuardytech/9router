# Architecture

This file summarizes the current architecture for `github.com/lazuardytech/pod` (v0.0.1).

## Package Layout

```
src/         Next.js app (dashboard UI + API routes + server libs)
open-sse/    routing engine (executors, translators, stream handling)
```

`open-sse` is a **local source package** resolved by `jsconfig.json` aliases (`open-sse/*`), not installed from npm.

## Boot and Routing

1. App runs through bun scripts (`bun run dev`, `bun run build`, `bun run start`).
2. `next.config.mjs` rewrites:
   - `/v1/:path*` -> `/api/v1/:path*`
   - `/codex/:path*` -> `/api/v1/responses`
3. Middleware/auth gateway is handled by `src/dashboardGuard.js` via `src/proxy.js`.

## Request Path (Chat)

`POST /v1/chat/completions` flow:

1. Rewritten to `/api/v1/chat/completions`
2. Route handler wraps request with per-key limiter:
   - `withApiKeyRateLimit` (`src/app/api/v1/_utils/apiKeyRateLimit.js`)
3. `src/sse/handlers/chat.js` resolves target model/provider and account
4. `open-sse/handlers/chatCore.js` executes core pipeline:
   - format detect + translation
   - optional RTK/caveman token processing
   - semantic cache read/write
   - memory retrieval + injection
   - upstream execution (streaming or non-streaming)
   - memory extraction from request/response content

## Cache and Memory Integration

- Semantic cache:
  - Storage tables: `semantic_cache`, `cache_metrics`
  - API: `/api/cache`, `/api/settings/cache-config`
  - Request behavior controlled by body/headers and cache settings
- Conversational memory:
  - Storage tables: `memories` + `memory_fts`
  - API: `/api/memory`, `/api/memory/[id]`, `/api/settings/memory`
  - `chatCore` injects retrieved memory and extracts new facts asynchronously

## API Key Limit Model

`api_keys` now stores:
- `limit_type` (`unlimited` or `limited`)
- `requests_per_minute`
- `concurrent_requests`

Limiter is enforced at `/api/v1/*` route layer via wrapper, including streaming-safe release of concurrent permits.

## Persistence

Primary store is SQLite:
- File: `~/.pod/pod.sqlite` (default; overridable via `DATA_DIR` env)
- Access via `src/lib/localDb.js` and `src/lib/sqlite/connection.js`
- `connection.js` applies pragmas and runs schema patches/migrations

Core data domains:
- providers, nodes, proxy pools, combos
- API keys
- settings/pricing
- usage logs/details
- semantic cache
- memories

## Dashboard Surface

Main dashboard routes (no `/dashboard` prefix):
- `/endpoint` — API keys table (max 15 rows, pagination, edit/remove)
- `/providers` — LLM Providers
- `/media-providers` — Media Providers
- `/combos` — Combos
- `/memory` — Conversational memory
- `/cache` — Semantic cache
- `/usage` — Usage & Analytics
- `/quota` — Quota Tracker
- `/proxy-pools` — Proxy Pools
- `/logs` — multi-tab: Request Logs, Proxy Logs, Console Logs
- `/settings` — Settings (Linear design, DB path, theme switcher)
- `/health` — System Health (TelemetryCard sparklines, DB health, Provider Health, Rate Limit Status)

`translator` and `basic-chat` pages still exist but are not part of the main sidebar taxonomy.

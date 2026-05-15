# Architecture

This file summarizes the current architecture for `github.com/lazuardytech/pod` (v0.0.6).

## Package Layout

```
src/         Next.js app (dashboard UI + API routes + server libs)
open-sse/    routing engine (executors, translators, stream handling)
```

`open-sse` is a **local source package** resolved by `jsconfig.json` aliases (`open-sse/*`), not installed from npm.

## Boot and Routing

1. App runs through bun scripts (`bun run dev`, `bun run build`, `bun run start`).
2. `next.config.mjs` rewrites:
   - `/v1/:path*` → `/api/v1/:path*`
   - `/codex/:path*` → `/api/v1/responses`
3. Middleware/auth gateway: `src/dashboardGuard.js` via `src/proxy.js`.

## Request Path (Chat)

`POST /v1/chat/completions` flow:

1. Rewritten to `/api/v1/chat/completions`
2. Route handler wraps with `withApiKeyRateLimit`
3. `src/sse/handlers/chat.js` resolves target model/provider/account
4. `open-sse/handlers/chatCore.js` executes core pipeline:
   - format detect + translation
   - optional RTK/caveman token processing
   - semantic cache read/write
   - memory retrieval + injection
   - upstream execution (streaming or non-streaming)
   - memory extraction from request/response content
   - `details_id` pre-generated and linked to `request_log` for reliable detail lookup

## Request Detail Linking

`request_log` has a `details_id` column (added v0.0.4) that directly references `request_details.id`.
This eliminates fuzzy timestamp matching for the request detail drawer in `/logs`.

Flow:
1. `generateDetailId(model)` called before `appendLog` and `saveRequestDetail`
2. `detailsId` passed to both calls
3. `request_log.details_id` stores the link
4. `/api/usage/request-logs/[id]` does direct lookup by `details_id` first, falls back to timestamp fuzzy match

## SSE Live Streams

Three endpoints push Server-Sent Events to the dashboard:

| Endpoint | Added | Description |
|---|---|---|
| `GET /api/console-log` | v0.0.1 | Console log stream |
| `GET /api/usage/request-logs/stream` | v0.0.6 | Request log live stream |
| `GET /api/proxy-pools/stream` | v0.0.6 | Proxy pool event stream |

All use the `open-sse` stream helpers. The `/logs` page surfaces Refresh/Live toggles for each tab.

## Cache and Memory Integration

- Semantic cache:
  - Tables: `semantic_cache`, `cache_metrics`
  - API: `/api/cache`, `/api/settings/cache-config`
- Conversational memory:
  - Tables: `memories`, `memory_fts`
  - API: `/api/memory`, `/api/memory/[id]`, `/api/settings/memory`

## API Key Limit Model

`api_keys` stores:
- `limit_type` (`unlimited` or `limited`)
- `requests_per_minute`
- `concurrent_requests`
- `last_access_at`

## Security (v0.0.6)

- `GET /v1/models`, `GET /v1/models/[kind]`, `GET /v1beta/models` now enforce API key auth when `settings.requireApiKey=true`.
- `validateApiKey` uses timing-safe comparison to prevent timing attacks.
- Previously these model listing endpoints were always public regardless of `requireApiKey`.

## Persistence

Primary store is SQLite:
- File: `~/.pod/pod.sqlite` (default; overridable via `DATA_DIR` env)
- Access via `src/lib/localDb.js` and `src/lib/sqlite/connection.js`
- `connection.js` applies pragmas and runs schema patches/migrations on boot

Schema migrations applied at boot (in `connection.js`):
- `combo` column on `request_log`
- `details_id` column on `request_log`

`DATA_DIR` env var: if the resolved data directory is inaccessible (EACCES/EPERM), the app falls back gracefully rather than crashing on boot.

## Dashboard Surface

All routes are top-level (no `/dashboard` prefix):

| Route | Description |
|---|---|
| `/endpoint` | API keys table, OpenAI/Anthropic/Tunnel/Tailscale endpoint config |
| `/providers` | LLM provider connections |
| `/media-providers` | Media provider connections (embedding, TTS, STT, image) |
| `/combos` | Model combos with fallback/round-robin, Test button per combo |
| `/memory` | Conversational memory entries |
| `/cache` | Semantic cache config and maintenance |
| `/usage` | Usage & Analytics (overview, request logs, provider topology) |
| `/quota` | Quota Tracker — grouped by provider, 3-level expand/collapse |
| `/proxy-pools` | Proxy pool management with Vercel relay deploy |
| `/logs` | Multi-tab: Request Logs, Proxy Logs, Console Logs |
| `/health` | System Health: telemetry, DB, provider health, rate limits, model lockouts |
| `/settings` | App settings (appearance, data, security, routing, network, observability, system info) |

## UI Architecture

- **Design system**: Linear (dark/light theme via CSS variables)
- **Theme**: class-based dark mode (`html.dark`), `@custom-variant dark` in globals.css
- **Toasts**: Sonner (`sonner@2.0.7`), position bottom-right
- **Drawers**: Vaul (`vaul@1.1.2`) for log detail drawer
- **Tabs**: `SegmentedControl` component standardized across all tab UIs, always `size="sm"`
- **Confirm dialogs**: `ConfirmModal` from `@/shared/components/Modal` — no browser `confirm()`
- **Icons**: Material Symbols Outlined (Google Fonts)
- **Logo**: `public/logo.svg` — SVG fill `#000`, `dark:invert` for dark theme
- **Header action slot**: page-level action buttons (e.g. "Connected Only" toggle) are registered via `src/store/headerActionStore.js` (Zustand). Pages register in `useEffect` and clean up on unmount. Do not render page-specific actions inline in the Header component.

## Proxy Fetch

`open-sse/utils/proxyFetch.js` patches global `fetch` with:
- Env proxy support (`HTTPS_PROXY`, `HTTP_PROXY`, `NO_PROXY`)
- Connection-level proxy (per-provider proxy config)
- Vercel relay forwarding via `x-relay-target` / `x-relay-path` headers

No MITM bypass code exists (removed in v0.0.4).

## Upstream Engine Fixes (v0.0.6)

The following fixes were adopted from upstream 9router into `open-sse`:

- **Role normalization**: `developer` role normalized to `system` before upstream dispatch
- **Stream stall timeout**: 3-minute timeout kills stalled streams
- **Ollama usage tracking**: token usage now extracted and recorded for Ollama responses
- **Gemini schema**: `ensureObjectType` applied to fix schema compatibility issues
- **Blackbox provider**: new LLM provider supported
- **MiniMax TTS**: new TTS provider supported

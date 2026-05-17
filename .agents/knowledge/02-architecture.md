# Architecture

This file summarizes the current architecture for `github.com/lazuardytech/pod` (v0.0.28).

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

**SSE abort handling (v0.0.13)**: `proxy-pools/stream` and `request-logs/stream` attach `request.signal.addEventListener("abort", cleanup)` to cancel `setInterval`/`setTimeout` on client disconnect. Missing this was the primary cause of the 1.2GB memory leak. All new SSE endpoints must follow this pattern.

**`usage/stream` debounce**: full `getUsageStats()` recalc is debounced to at most once per 2s per connection.

## Cache and Memory Integration

- Semantic cache:
  - Tables: `semantic_cache`, `cache_metrics`
  - API: `/api/cache`, `/api/settings/cache-config`
  - Streaming requests (`stream: true`) are cached. After `onStreamComplete`, the assembled response is written to cache. Cache hits for streaming clients are served as SSE chunks via `buildCacheHitSSEResponse` in `open-sse/handlers/chatCore.js`.
  - **Critical**: `cacheSignature` is computed from original `body.messages` BEFORE `injectMemory()` mutates the body. All write paths reuse this pre-computed signature. Never recompute from `body.messages` at write time.
  - `requestTooLargeForCache` guard removed — `generateSignature` already handles large payloads via 64KB tail hash. Do not re-add size-based bypass guards.
- Temperature threshold for cache eligibility: `temperature > 1` (changed from `temperature !== 0` in v0.0.13 — most clients send `temperature: 1` by default, which was incorrectly bypassing cache).
- Conversational memory:
  - Tables: `memories`, `memory_fts`
  - API: `/api/memory`, `/api/memory/[id]`, `/api/settings/memory`
  - In-process store: `LRUCache` (500 entries, 4MB max, 300s TTL) — replaced plain Map in v0.0.13 to bound memory growth.

## API Key Limit Model

`api_keys` stores:
- `limit_type` (`unlimited` or `limited`)
- `requests_per_minute`
- `concurrent_requests`
- `last_access_at` — updated on every authenticated request via `getApiKeyByKey()`, displayed in the /endpoint table

## Model Lock Count

`modelLockCount_${model}` is a flat field on connection rows. It is incremented each time a model is locked and cleared on success. The value is used as a backoff multiplier for minimum lockout duration (1x on first failure, 2x on second, 3x on third, etc.).

## models.dev Pricing Sync

`src/lib/modelsDevSync.js` fetches pricing data from models.dev, transforms it, and saves it to SQLite (`models_dev_pricing`, `models_dev_sync_meta` tables). `startPeriodicSync()` is called from `initializeApp.js` on boot. Sync interval is controlled by `modelCostSyncIntervalHours` in settings (default 1h). A "Sync Now" button and status are exposed in /settings.

Pricing resolution order:
1. User overrides (manual pricing entries)
2. models.dev data
3. Static fallback

API: `GET /api/pricing/sync` (status), `POST /api/pricing/sync` (trigger immediate sync).

Field mapping from models.dev response: `model.cost.input`, `model.cost.output`, `model.cost.cache_read` → `cached`, `model.cost.cache_write` → `cache_creation`, `model.cost.reasoning`.

## Security (v0.0.6)

- `GET /v1/models`, `GET /v1/models/[kind]`, `GET /v1beta/models` now enforce API key auth when `settings.requireApiKey=true`.
- `validateApiKey` uses timing-safe comparison to prevent timing attacks.
- Previously these model listing endpoints were always public regardless of `requireApiKey`.

## Persistence

Primary store is SQLite:
- File: `~/.pod/pod.sqlite` (default; overridable via `DATA_DIR` env)
- Access via `src/lib/localDb.js` and `src/lib/sqlite/connection.js`
- `connection.js` applies pragmas and runs schema patches/migrations on boot
- SQLite pragmas tuned for lower memory: `mmap_size` 64MB (down from 256MB), `cache_size` 16MB (down from 64MB)

Schema migrations applied at boot (in `connection.js`):
- `combo` column on `request_log`
- `details_id` column on `request_log`
- `sort_order` column on `combos` (backfilled from `rowid`)
- `models_dev_pricing` and `models_dev_sync_meta` tables (added via `ensureSchemaPatches` for models.dev pricing sync)

`LOG_MAX_ROWS` in `src/lib/usageDb.js` is set to **10 000**. The `/api/usage/request-logs` endpoint serves up to 10 000 rows.

`usage_history` is trimmed to `USAGE_HISTORY_MAX_DAYS = 90` days, triggered every 100 inserts. `getUsageHistory()` default LIMIT is 10 000. `requestDetailsDb` write buffer is capped at `WRITE_BUFFER_MAX = 500`.

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

## Provider Node Rename

Custom provider nodes (`openai-compatible-*`, `anthropic-compatible-*`, `custom-embedding-*`) can be renamed after creation.

- **Function**: `renameProviderNode(oldId, newId)` in `src/lib/localDb.js`
- **Endpoint**: `PATCH /api/provider-nodes/[id]/rename`
- **Cascade**: single SQLite transaction updates `provider_nodes.id` + all FK columns (`provider_connections.provider`, `custom_models.provider_alias`, `pricing.provider`, `usage_history.provider`, `request_details.provider`, `request_log.provider`, `daily_summary.key`) + JSON blobs (`combos.data` models array, `model_aliases.target`, `settings.value` for `providerStrategies`/`providerThinking`)
- **Redirect tracking**: `previousIds[]` appended to node `data` JSON on each rename. `ProviderDetailClient` checks `previousIds` when a node is not found by current URL id and calls `router.replace` to the current id — bookmark URLs self-heal permanently.
- **Cache invalidation**: `invalidateConnectionsCache` called after commit to flush in-memory connection/rotation state.
- **Validation**: built-in provider IDs rejected; new id must preserve the type prefix; collision with existing nodes blocked.
- **UI**: Identifier field in Edit Compatible modal is now editable with a dedicated Rename button (prefix hint shown). Built-in providers remain read-only.

## Docker Runtime

`Dockerfile` CMD is `bun /app/server.js` (no `--smol`).
Memory is bounded via cache env vars set in the Dockerfile:
- `SEMANTIC_CACHE_MAX_BYTES=2097152` (2MB, default 4MB)
- `SEMANTIC_CACHE_MAX_SIZE=50` (default 100)
- `PROMPT_CACHE_MAX_BYTES=1048576` (1MB, default 2MB)
- `PROMPT_CACHE_MAX_SIZE=25` (default 50)

Rationale: `--smol` throttles the entire heap and hurts throughput. Bun's high RSS vs Node is a runtime characteristic, not a leak — the actual leaks (SSE abort, LRU, SQLite pragmas) were fixed in v0.0.13.

## Upstream Engine Fixes (v0.0.6)

The following fixes were adopted from upstream pod into `open-sse`:

- **Role normalization**: `developer` role normalized to `system` before upstream dispatch
- **Stream stall timeout**: 3-minute timeout kills stalled streams
- **Ollama usage tracking**: token usage now extracted and recorded for Ollama responses
- **Gemini schema**: `ensureObjectType` applied to fix schema compatibility issues
- **Blackbox provider**: new LLM provider supported
- **MiniMax TTS**: new TTS provider supported

# API Surface

All public compatibility endpoints are routed through rewrites in `next.config.mjs`:

- `/v1/:path*` -> `/api/v1/:path*`
- `/codex/:path*` -> `/api/v1/responses`

## Public Compatibility APIs

### OpenAI-compatible

- `POST /v1/chat/completions`
- `POST /v1/responses`
- `POST /v1/responses/compact`
- `POST /v1/embeddings`
- `POST /v1/audio/speech`
- `POST /v1/audio/transcriptions`
- `POST /v1/images/generations`
- `GET /v1/models`
- `GET /v1/models/{kind}` 
- `POST /v1/search`
- `POST /v1/web/fetch`

### Anthropic-compatible

- `POST /v1/messages`
- `POST /v1/messages/count_tokens`

### Gemini-compatible

- `GET /v1beta/models`
- `* /v1beta/models/{...path}`

> **Auth note**: `GET /v1/models`, `GET /v1/models/[kind]`, and `GET /v1beta/models` enforce API key auth when `requireApiKey=true`. These were previously unauthenticated.

### Ollama-compatible

- `POST /v1/api/chat`

## Per-Key Rate Limiting on `/v1/*`

All major `/api/v1/*` POST routes are wrapped by:
- `src/app/api/v1/_utils/apiKeyRateLimit.js`

Behavior:
- `unlimited`: no limiter
- `limited`: enforces both req/min and concurrent request ceilings
- 429 response with `Retry-After` when exceeded

## Dashboard and Management APIs (non-`/v1`)

Important groups under `src/app/api/`:

- Auth/session: `auth/*`
- Providers and nodes: `providers/*`, `provider-nodes/*`
  - `PATCH /api/provider-nodes/[id]/rename` — rename a custom provider node identifier (atomic cascade, custom nodes only)
- API keys: `keys/*`
- Combos: `combos/*`
- Usage analytics: `usage/*`
- Settings: `settings/*`
- Memory and cache:
  - `GET|DELETE /api/cache`
  - `GET|PUT /api/settings/cache-config`
  - `GET|POST /api/memory`
  - `GET|PATCH|DELETE /api/memory/[id]`
  - `GET|PUT /api/settings/memory`
- Tunnel/network ops: `tunnel/*`, `proxy-pools/*`
- Translator/debug: `translator/*`, `console-log`

## Pricing Sync API

| Endpoint | Description |
|---|---|
| `GET /api/pricing/sync` | Returns models.dev sync status (last sync time, model count, interval) |
| `POST /api/pricing/sync` | Triggers an immediate models.dev pricing sync |

Sync runs automatically on boot via `startPeriodicSync()` in `initializeApp.js`. Interval controlled by `modelCostSyncIntervalHours` in settings (default 1h).

## Tunnel API

| Endpoint | Description |
|---|---|
| `POST /api/tunnel/enable` | Spawns cloudflared and returns immediately. No DNS warmup delay. `fetchData()` refresh is non-fatal. |
| `POST /api/tunnel/disable` | Stops cloudflared tunnel |
| `GET /api/tunnel/status` | Returns current tunnel status |

## SSE Streaming Endpoints

Three live-stream endpoints use Server-Sent Events:

| Endpoint | Description |
|---|---|
| `GET /api/usage/request-logs/stream` | Live stream of incoming request log entries |
| `GET /api/proxy-pools/stream` | Live stream of proxy pool events |
| `GET /api/console-log` | Console log stream (existing) |

All SSE endpoints follow the same `open-sse` stream helper pattern.

## API Key Validation Model

- Public auth can be enforced by `settings.requireApiKey`
- Accepted headers: `Authorization: Bearer ...` or `x-api-key`
- Key format parsing/validation lives in `src/shared/utils/apiKey.js`

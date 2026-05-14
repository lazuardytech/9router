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

## API Key Validation Model

- Public auth can be enforced by `settings.requireApiKey`
- Accepted headers: `Authorization: Bearer ...` or `x-api-key`
- Key format parsing/validation lives in `src/shared/utils/apiKey.js`

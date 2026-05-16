# Providers and Routing

## Provider Configuration Sources

| File | Purpose |
|---|---|
| `open-sse/config/providers.js` | provider transport config (base URL, format, headers) |
| `open-sse/config/providerModels.js` | per-model target format and strip rules |
| `open-sse/config/errorConfig.js` | fallback/backoff behavior |
| `src/shared/constants/providers.js` | dashboard/provider catalog and metadata |
| `src/shared/constants/models.js` | static model catalog used by UI |

## Routing Pipeline

Main flow for chat-compatible requests:

1. `src/sse/handlers/chat.js` resolves model/provider
2. Combo check:
   - combo model list fallback/round-robin
3. Provider account selection:
   - `src/sse/services/auth.js`
   - applies active-state checks, model lock checks, and strategy
4. Core execution:
   - `open-sse/handlers/chatCore.js`
   - translation, token tools, cache/memory, executor dispatch

## Fallback Layers

1. Combo-level fallback (`open-sse/services/combo.js`)
2. Account-level fallback (`src/sse/services/auth.js` + `open-sse/services/accountFallback.js`)
3. Token refresh/retry inside executor path for auth-expired accounts

`modelLock_*` cooldown remains model-scoped (not global account lock).

## Executors

Executor registry:
- `open-sse/executors/index.js`
- Specialized executors for some providers
- `default.js` for generic OpenAI-compatible providers

Execution contract is still request/response based, with streaming handled in chatCore handlers.

## Auth Layers

1. Dashboard session auth (JWT/cookie, guarded routes in `dashboardGuard.js`)
2. API key auth for `/v1/*` (toggle via `settings.requireApiKey`)
3. Per-key traffic limiting:
   - `limitType: unlimited | limited`
   - limited mode enforces req/min and concurrent caps
   - wrapper: `withApiKeyRateLimit` on `/api/v1/*` routes

## Translation and Output Handling

- OpenAI-like request/response shapes are the canonical transform center
- Format adapters live in `open-sse/translator/*`
- Streaming/non-streaming handlers are split in `open-sse/handlers/chatCore/*`
- Reasoning/thinking metadata passthrough fixes are active in current `open-sse` baseline.

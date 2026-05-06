# API Surface

All `/v1/*` rewritten to `/api/v1/*` (`next.config.mjs:23-46`). `/codex/*` always rewrites to `/api/v1/responses`.

## OpenAI-compatible

| Route | Method | File | Purpose |
|---|---|---|---|
| `/v1/chat/completions` | POST | `src/app/api/v1/chat/completions/route.js:30` | Chat (multi-format) |
| `/v1/responses` | POST | `src/app/api/v1/responses/route.js:27` | OpenAI Responses API |
| `/v1/responses/compact` | POST | `src/app/api/v1/responses/compact/route.js:27` | Conversation compact |
| `/v1/embeddings` | POST | `src/app/api/v1/embeddings/route.js:19` | Embeddings |
| `/v1/audio/speech` | POST | `src/app/api/v1/audio/speech/route.js:14` | TTS |
| `/v1/audio/transcriptions` | POST | `src/app/api/v1/audio/transcriptions/route.js:17` | STT (Whisper-compat) |
| `/v1/images/generations` | POST | `src/app/api/v1/images/generations/route.js:14` | Image gen |
| `/v1/models` | GET | `src/app/api/v1/models/route.js:385` | LLM model list |
| `/v1/models/{kind}` | GET | `src/app/api/v1/models/[kind]/route.js` | Models by kind |
| `/v1/search` | POST | `src/app/api/v1/search/route.js:19` | Web search |
| `/v1/web/fetch` | POST | `src/app/api/v1/web/fetch/route.js:19` | URL fetch/extract |

## Anthropic-compatible

| Route | Method | File |
|---|---|---|
| `/v1/messages` | POST | `src/app/api/v1/messages/route.js:32` |
| `/v1/messages/count_tokens` | POST | `src/app/api/v1/messages/count_tokens/route.js:17` |

## Gemini-compatible

| Route | Method | File |
|---|---|---|
| `/v1beta/models` | GET | `src/app/api/v1beta/models/route.js:20` |
| `/v1beta/models/{...path}` | * | `src/app/api/v1beta/models/[...path]/route.js` |

## Ollama-compatible

| Route | Method | File |
|---|---|---|
| `/v1/api/chat` | POST | `src/app/api/v1/api/chat/route.js:24` |

## Format auto-detect

`open-sse/translator/formats.js:21` `detectFormatByEndpoint`:
- `/v1/responses` → `openai-responses`
- `/v1/messages` → `claude`
- else → body-based detection

## Mgmt API (dashboard backend)

`src/app/api/` — non-`v1` routes for the dashboard:

`auth/`, `oauth/[provider]/`, `providers/`, `provider-nodes/`, `keys/`, `combos/`, `models/alias/`, `pricing/`, `settings/`, `usage/`, `sync/`, `cloud/`, `media-providers/`, `proxy-pools/`, `tunnel/`, `translator/`, `init/`, `health/`, `version/`, `shutdown/`, `tags/`, `locale/`.

## Public endpoints (`/v1/*`) — auth model

Off by default. When `settings.requireApiKey=true`, all handlers in `src/sse/handlers/*.js` validate `Authorization: Bearer` or `x-api-key` against `localDb.apiKeys` via `validateApiKey`.

API key format: `sk-{machineId}-{keyId}-{crc8}`. Generated/validated in `src/shared/utils/apiKey.js`.

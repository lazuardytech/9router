# Providers & Routing

## Provider catalog files

| File | Role |
|---|---|
| `open-sse/config/providers.js` | Wire definitions: baseUrl, format, headers, OAuth clientId/tokenUrl |
| `open-sse/config/providerModels.js` | Per-model overrides: `targetFormat`, `strip[]` |
| `open-sse/config/errorConfig.js` | Fallback rules + backoff config |
| `src/shared/constants/providers.js` | UI-side catalog: auth method groups |
| `src/shared/constants/models.js` | Static `PROVIDER_MODELS` lists |

## Auth method groups (`src/shared/constants/providers.js`)

- **OAUTH_PROVIDERS**: claude (Claude Code), antigravity (deprecated), codex, github (Copilot), cursor, kilocode, cline, gemini-cli (deprecated), qwen (deprecated 2026-04-15), iflow, kiro, kimi-coding, qoder
- **APIKEY_PROVIDERS**: openai, anthropic, openrouter, glm/glm-cn, kimi, minimax/minimax-cn, alicode/intl, volcengine-ark, byteplus, deepseek, groq, xai, mistral, perplexity, together, fireworks, cerebras, cohere, nebius, siliconflow, hyperbolic, nvidia, chutes, blackbox, xiaomi-mimo, nanobanana, opencode-go, azure, cloudflare-ai, ollama/ollama-local
- **Cloud creds (Service Account JSON)**: vertex, vertex-partner, aws-polly
- **WEB_COOKIE_PROVIDERS**: grok-web (sso=), perplexity-web (`__Secure-next-auth.session-token`)
- **No-auth/free**: opencode (public), searxng, local TTS engines (edge-tts, google-tts, local-device, coqui, tortoise)
- **Media-only**: ElevenLabs, Cartesia, Deepgram, AssemblyAI, Voyage, Jina, HuggingFace, Fal.ai, Stability, BFL, Recraft, Topaz, Runway, Tavily, Brave, Serper, Exa, Linkup, SearchAPI, You.com, Firecrawl, GooglePSE

## Executor layer

```
open-sse/executors/
├── index.js          ← getExecutor(provider) registry
├── base.js           ← BaseExecutor
├── default.js        ← fallback for generic OpenAI-compat providers
└── {antigravity, azure, codex, cursor, gemini-cli, github,
    grok-web, iflow, kiro, opencode, opencode-go,
    perplexity-web, qoder, qwen, vertex}.js
```

`getExecutor(provider)` (`executors/index.js:42`) caches per-provider. Anything not in the specialized list → `DefaultExecutor`.

Executor interface: `execute({model, body, stream, credentials, signal, ...}) → {response, url, headers, transformedBody}`. Optional `parseError(response)` for `resetsAtMs` extraction; optional `refreshCredentials()` for 401/403 retry.

## Routing decision flow

**Code-driven dispatch + DB-driven account selection.** No tier system.

```
client → /v1/chat/completions
  → handleChat (src/sse/handlers/chat.js:28)
      ├─ if combo: handleComboChat → iterate combo's model list
      └─ else: handleSingleModelChat
            ├─ getModelInfo (src/sse/services/model.js:18)
            │     resolve order:
            │       1. modelAliases (from db.json)
            │       2. combos
            │       3. provider/model parse ("provider/model" syntax)
            │       4. provider-node prefix match
            └─ while loop:
                  getProviderCredentials(provider, excludeIds, model)
                    └─ src/sse/services/auth.js:18
                        ├─ mutex-guarded
                        ├─ free providers → virtual "public" connection w/ proxy pool
                        ├─ filter: isActive, exclude set, isModelLockActive
                        └─ strategy: settings.providerStrategies[providerId]
                            ├─ fill-first (priority sort)
                            └─ round-robin (sticky-N, default stickyRoundRobinLimit:3)
                  on success → clearAccountError
                  on fail → markAccountUnavailable + retry next
```

## Inbound auth (clients → proxy)

Two layers, both optional/togglable:

1. **Dashboard JWT** (`src/dashboardGuard.js`) — cookie-based. Always-protected: `/api/shutdown`, `/api/settings/database`. Login at `/api/auth/login`. CLI bypass via `x-9r-cli-token` header (HMAC of machine-id with `MACHINE_ID_SALT`).
2. **API key for `/v1/*`** (off by default) — toggled by `settings.requireApiKey`. Validated in handlers (`src/sse/handlers/{chat,embeddings,fetch,search,imageGeneration,stt,tts}.js`). Format: `sk-{machineId}-{keyId}-{crc8}`. Validation in `src/shared/utils/apiKey.js:49` `parseApiKey` using `API_KEY_SECRET`.

Required env: `JWT_SECRET`, `INITIAL_PASSWORD`, `API_KEY_SECRET`, `MACHINE_ID_SALT`.

## RTK (Reduce Token Kit)

JS port of a Rust pipe-filter system. Compresses `tool_result` / `function_call_output` content before upstream send.

Location: `open-sse/rtk/`

| File | Role |
|---|---|
| `index.js:8` | `compressMessages(body, enabled)` entry |
| `autodetect.js:24` | `autoDetectFilter(text)` sniffs format |
| `registry.js:13` | filter name → fn map (aliases `rg→grep`, `fd→find`) |
| `applyFilter.js:3` | `safeApply` try/catch passthrough |
| `filters/*.js` | gitDiff, gitStatus, grep, find, ls, tree, dedupLog, smartTruncate, readNumbered, searchList |
| `caveman.js`, `cavemanPrompts.js` | terse-prompt injection (separate feature) |

Applied at `open-sse/handlers/chatCore.js:102` AFTER format translation, BEFORE executor dispatch. Toggle: `settings.rtkEnabled`. Caveman: `settings.cavemanEnabled` + `cavemanLevel`.

Logs: `[RTK] saved NB / NB (X%) via [filter,...] hits=N`.

Safety: if filter throws or makes output bigger → keep original text.

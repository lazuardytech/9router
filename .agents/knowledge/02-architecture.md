# Architecture

Authoritative ref: `docs/ARCHITECTURE.md` (557 lines). This is the agent-friendly summary.

## Two-package layout

```
src/         ← Next.js app: UI, API routes (REST surface), thin handlers
open-sse/    ← Engine: provider configs, executors, translators, streaming, RTK
```

`open-sse/` has no dist step. Edits are live. Imported via bare `open-sse/...` thanks to `jsconfig.json:6-7` aliases. NOT in `package.json`.

## Boot flow

1. `package.json` scripts → `next dev` / `next start` on port **20128**.
2. Next loads `src/app/layout.js`, which side-imports init modules: `initCloudSync`, `initOutboundProxy`, `initConsoleLogCapture`.
3. `src/server-init.js` → `src/shared/services/initializeApp.js:46` wires tunnel resume, MITM auto-start, watchdog, network monitor. Singleton-guarded with `global.__appSingleton ??=` for HMR.
4. Middleware: `src/proxy.js` re-exports from `src/dashboardGuard.js` (JWT cookie + machine-id CLI token bypass).
5. Rewrites in `next.config.mjs:23-46`: `/v1/*` → `/api/v1/*`, `/codex/*` → `/api/v1/responses`.

## Request flow (chat completion)

```
POST /v1/chat/completions
  → next.config.mjs rewrite → /api/v1/chat/completions
  → src/dashboardGuard.js (passthrough; not in protected list)
  → src/app/api/v1/chat/completions/route.js  (POST handler)
  → src/sse/handlers/chat.js:28  handleChat()
      ├─ ensureInitialized() → initTranslators()
      ├─ parse body, extract API key, enforce requireApiKey
      ├─ check combo → handleComboChat (open-sse/services/combo.js)
      └─ single model → handleSingleModelChat (chat.js:120)
            ├─ getModelInfo (src/sse/services/model.js:18)  ← alias/provider resolution
            ├─ LOOP: getProviderCredentials (src/sse/services/auth.js:18)  ← account selection
            │   ├─ checkAndRefreshToken
            │   └─ handleChatCore (open-sse/handlers/chatCore.js:29)
            │         ├─ format detect (translator/formats.js:21)
            │         ├─ translateRequest
            │         ├─ compressMessages (RTK)
            │         ├─ getExecutor(provider) (executors/index.js)
            │         ├─ executor.execute() → upstream fetch
            │         └─ stream/non-stream/forced-SSE handler in handlers/chatCore/
            └─ on fail: markAccountUnavailable → retry next account
```

## Three fallback layers

1. **Combo** (`open-sse/services/combo.js`) — model list with `fallback` or `round-robin` (sticky-N) strategy.
2. **Account** (`src/sse/handlers/chat.js:166` while-loop + `open-sse/services/accountFallback.js`) — try each provider connection. Strategy `fill-first` (priority sort) or `round-robin` (sticky-N). Per-provider override via `settings.providerStrategies[provider].fallbackStrategy`.
3. **Token refresh** (`chatCore.js:193`) — on 401/403 → `executor.refreshCredentials()` then single retry.

Cooldown is **per-model**, not per-account: `auth.js:198` writes `modelLock_${model}` lock with cooldown from `accountFallback.js:23` `checkFallbackError` (config in `open-sse/config/errorConfig.js`, exponential backoff).

## Translator (format conversion)

OpenAI is the canonical hop. Registry: `open-sse/translator/index.js`. Converters in `translator/request/*.js` and `translator/response/*.js`:

- claude ↔ openai
- gemini ↔ openai
- openai-responses ↔ openai
- antigravity / kiro / cursor / ollama → openai

Native passthrough when CLI ecosystem matches provider (`open-sse/utils/clientDetector.js`, applied at `chatCore.js:79`).

Strip rules per model: `PROVIDER_MODELS.strip[]` (image/audio content-types removed for text-only models) — `translator/index.js:56`.

## Storage

| Store | File | Lib |
|---|---|---|
| Main config + connections | `$DATA_DIR/db.json` | lowdb (`src/lib/localDb.js`) |
| Usage history | `$DATA_DIR/usage.json` + `log.txt` | lowdb (`src/lib/usageDb.js`) |
| Request details | `$DATA_DIR/request-details.json` (50MB cap) | lowdb (`src/lib/requestDetailsDb.js`) |
| Disabled models | local JSON | lowdb (`src/lib/disabledModelsDb.js`) |
| Tunnel state | local JSON | `src/lib/tunnel/state.js` |
| Cursor token import | reads Cursor's SQLite | `better-sqlite3` (optional) or `sqlite3` CLI fallback |
| Cloud Worker DB | D1 SQLite | `cloud/migrations/0001_init.sql` |

`$DATA_DIR` default: `~/.9router/` (or `%APPDATA%/9router` on Windows). Override with env. Code: `src/lib/dataDir.js:6-12`. Writes guarded by `proper-lockfile`.

## Frontend (dashboard)

Route group `src/app/(dashboard)/dashboard/`: basic-chat, cli-tools, combos, console-log, endpoint, media-providers, mitm, profile, providers, proxy-pools, quota, skills, translator, usage.

Public pages: `login/`, `landing/`, `callback/` (OAuth).

Zustand stores: `src/store/{themeStore, userStore, providerStore, notificationStore, headerSearchStore}.js`. All `"use client"`-prefixed. Records use `_id` (Mongo-style, but backed by lowdb).

Charts = recharts. Code editor = Monaco. Combo graph = @xyflow/react.

i18n: 33 locales. `src/i18n/runtime.js` DOM-walks at runtime, fetches `/i18n/literals/${locale}.json`. Locale stored in `locale` cookie.

## MITM subsystem

`src/mitm/` — TLS interception for upstream traffic. Uses `node-forge` for cert gen. Bootstrapped via env-var bridge ESM→CJS at `initializeApp.js:22-32`. Has private dev submodule `src/mitm/dev` → `decolua/9router-dev.git`.

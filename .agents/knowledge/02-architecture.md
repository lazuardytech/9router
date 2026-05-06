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
      ├─ initTranslators() (lazy-loads translators via ensureInitialized())
      ├─ parse body, extract API key, enforce requireApiKey
      ├─ check combo → handleComboChat (open-sse/services/combo.js)
      └─ single model → handleSingleModelChat (chat.js:120)
            ├─ getModelInfo (src/sse/services/model.js:18)  ← alias/provider resolution
            ├─ LOOP: getProviderCredentials (src/sse/services/auth.js:18)  ← account selection
            │   ├─ checkAndRefreshToken
            │   └─ handleChatCore (open-sse/handlers/chatCore.js:29)
            │         ├─ format detect (translator/formats.js:21)
            │         ├─ translateRequest (lazy-loads translators on first call)
            │         ├─ compressMessages (RTK)
            │         ├─ getExecutor(provider) (executors/index.js)
            │         ├─ createUpstreamSignal() → combined AbortController
            │         │    (client disconnect + upstream timeout via API_TIMEOUT_MS)
            │         ├─ executor.execute() → upstream fetch
            │         └─ stream/non-stream/forced-SSE handler in handlers/chatCore/
            │              decloakSSELine() strips Claude tool cloak per SSE line
            └─ on fail: markAccountUnavailable → retry next account
```

### Upstream timeout

`chatCore.js:158-190` — combined `AbortController` merges client disconnect + upstream deadline:

- `LOCAL_UPSTREAM_TIMEOUT_MS = 45000` (`runtimeConfig.js:49`)
- Override via `API_TIMEOUT_MS` env var
- Timeout → 408 (Request Timeout), client abort → 499
- 502/503 retry: 2 attempts @ 1500ms each
- 504: no retry (0 attempts)

### Claude tool name decloaking

`open-sse/utils/claudeCloaking.js` — upstream Claude Code apps send tool calls with obfuscated names. On every client-bound path:

1. **`decloakToolNames()`** — recursive shape-agnostic walker renames `tool_use.name` back via `toolNameMap`
2. **`stripClaudeToolSuffixes()`** — strips `_9r` suffix (`CLAUDE_TOOL_SUFFIX`) from tool names
3. **`decloakSSELine()`** in `stream.js` — per-line SSE decloak in both transform + passthrough mode
4. `createPassthroughStreamWithLogger()` now accepts `sourceFormat` + `toolNameMap` params

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

**SQLite** is the primary store (migrated from lowdb+JSON via upstream PR #794).

| Store | SQLite Table | Schema |
|---|---|---|
| Provider connections | `provider_connections` | `src/lib/sqlite/schema.js:14-27` |
| Provider nodes | `provider_nodes` | `src/lib/sqlite/schema.js:28-38` |
| Proxy pools | `proxy_pools` | `src/lib/sqlite/schema.js:40-49` |
| Combos | `combos` | `src/lib/sqlite/schema.js:51-57` |
| API keys | `api_keys` | `src/lib/sqlite/schema.js:59-67` |
| Model aliases | `model_aliases` | `src/lib/sqlite/schema.js:71-73` |
| Settings | `settings` (kv) | `src/lib/sqlite/schema.js:89-92` |
| Pricing | `pricing` | `src/lib/sqlite/schema.js:94-99` |
| Usage history | `usage_history` | `src/lib/sqlite/schema.js:103-120` |
| Daily summary | `daily_summary` | `src/lib/sqlite/schema.js:125-136` |
| Request details | `request_details` | `src/lib/sqlite/schema.js:145-158` |
| Request log | `request_log` | `src/lib/sqlite/schema.js:162-172` |
| KV metadata | `meta` | `src/lib/sqlite/schema.js:138-142` |

**Engine**: `better-sqlite3` on Node, `bun:sqlite` on Bun (`src/lib/sqlite/connection.js:93-95`). Both external in `next.config.mjs` so webpack doesn't bundle them.

**File**: `$DATA_DIR/9router.sqlite` (default `~/.9router/`).

**Facade**: `src/lib/localDb.js` wraps SQLite with the same API as the old lowdb — 35+ consumers unchanged. Cloudflare Workers branch uses in-memory lowdb stub.

**Pragmas** (connection.js:38-53): WAL mode, NORMAL sync, 5s busy timeout, 64MB cache, 256MB mmap, MEMORY temp, 1000 WAL checkpoint.

**Auto-migration**: On first boot, `runInitialMigration()` in `connection.js:72-80` imports legacy `db.json` → SQLite via `src/lib/sqlite/migrate-from-json.js`. Log files (`usage.json`, `request-details.json`) NOT auto-migrated (would duplicate rows). Manual trigger: `POST /api/settings/migrate-sqlite`.

**Legacy remaining lowdb (unmigrated)**:
- `disabledModelsDb.js` — still lowdb JSON
- `src/lib/tunnel/state.js` — still JSON

`$DATA_DIR` default: `~/.9router/` (or `%APPDATA%/9router` on Windows). Override with env. Code: `src/lib/dataDir.js:6-12`.

## Frontend (dashboard)

Route group `src/app/(dashboard)/dashboard/`: basic-chat, combos, console-log, endpoint, media-providers, mitm, profile, providers, proxy-pools, quota, skills, translator, usage.

Public pages: `login/`, `landing/`, `callback/` (OAuth).

Zustand stores: `src/store/{themeStore, userStore, providerStore, notificationStore, headerSearchStore}.js`. All `"use client"`-prefixed. Records use `_id` (Mongo-style, but backed by SQLite).

Charts = recharts. Code editor = Monaco. Combo graph = @xyflow/react.

i18n: 33 locales. `src/i18n/runtime.js` DOM-walks at runtime, fetches `/i18n/literals/${locale}.json`. Locale stored in `locale` cookie.

## MITM subsystem

`src/mitm/` — TLS interception for upstream traffic. Uses `node-forge` for cert gen. Bootstrapped via env-var bridge ESM→CJS at `initializeApp.js:22-32`. Has private dev submodule `src/mitm/dev` → `decolua/9router-dev.git`.

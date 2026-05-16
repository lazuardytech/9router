# Gotchas

Read this before changing core flow.

## 1) `open-sse` is local code, not dependency

`open-sse/*` imports resolve via `jsconfig.json`. Do not install or replace with npm package versions.

## 2) `/v1/*` is rewrite-driven

`next.config.mjs` rewrites `/v1/*` to `/api/v1/*`. Do not create conflicting Next pages under `/v1`.

## 3) bun-only workflow

Use bun for install/build/test/CI parity. Do not use npm or pnpm commands in this repo.

## 4) Public API limiter is route-wrapped

`withApiKeyRateLimit` is applied on `/api/v1/*` routes. If you add a new public POST endpoint, wire the wrapper unless explicitly exempt.

## 5) API key model has limit fields

`api_keys` includes `limit_type`, `requests_per_minute`, `concurrent_requests`, `last_access_at`.
Do not assume all keys are unlimited.

## 6) Cache and memory are first-class features

- Cache: `/api/cache`, `/api/settings/cache-config`
- Memory: `/api/memory`, `/api/memory/[id]`, `/api/settings/memory`

If you touch chat pipeline, validate cache/memory behavior.

## 7) Sidebar taxonomy is intentional

Keep the grouped menu layout:
- API
- Analytics
- System

Route pages can exist without sidebar exposure (e.g. translator/basic-chat).

## 8) SQLite is the source of truth

Default file: `~/.pod/pod.sqlite`.
Use `localDb` / sqlite helpers instead of ad-hoc JSON state changes.

## 9) `log.warn()` caveat

`src/sse/utils/logger.js` currently does not emit `warn` logs. Prefer `log.error` or `console.warn`.

## 10) CI lint step is non-blocking

`ci.yml` runs `bun x eslint . || true`. Do not assume lint failure blocks CI.

## 11) Docker publishing target

Release images publish to Docker Hub `lazuardytech/pod` via tag `v*`.
Do not document GHCR for this repo.

## 12) No `/dashboard` prefix on routes

All dashboard routes are top-level (e.g. `/endpoint`, `/providers`, `/logs`, `/health`).
Do not add or assume a `/dashboard` prefix when linking or redirecting.

## 13) `/logs` is the consolidated log page

Multi-tab: Request Logs, Proxy Logs, Console Logs.
Do not create standalone `/console-log` or `/proxy-logs` pages.

## 14) No browser `confirm()`

Always use `<ConfirmModal>` from `@/shared/components/Modal`.
All existing `confirm()` calls have been replaced as of v0.0.4.

## 15) No MITM bypass code

MITM DNS bypass was removed in v0.0.4. Do not re-add `MITM_BYPASS_HOSTS`, `resolveRealIP`, `createBypassRequest`, or `getMitmAlias`/`setMitmAliasAll`.

## 16) `request_log.details_id` links to `request_details`

As of v0.0.5, `request_log` has a `details_id` column.
When saving a completed request, pre-generate the ID with `generateDetailId(model)` and pass it to both `appendRequestLog` and `saveRequestDetail`.
The `/api/usage/request-logs/[id]` route does direct lookup by `details_id` first.

## 17) `better-sqlite3` is devDependency only

Production uses `bun:sqlite`. `better-sqlite3` is only for tests (Node/vitest).
Do not import `better-sqlite3` in production code paths.

## 18) Version bump requires two files

Always bump both:
- `package.json` → `"version"`
- `src/shared/constants/config.js` → `displayVersion`

## 19) System info must come from server-side API

`process.platform`, `process.arch`, `Bun.version` are not available in client components.
Fetch from `/api/settings` which includes `systemInfo: { runtime, platform }`.

## 20) SegmentedControl for all tab UIs

Use `<SegmentedControl>` from `@/shared/components/SegmentedControl` for all pill tab navigation.
Always use `size="sm"`. Do not create custom inline tab div/button patterns.

## 21) GET /v1/models and /v1beta/models require auth when requireApiKey=true

As of v0.0.6, model listing endpoints enforce API key auth when `settings.requireApiKey` is enabled.
Do not assume these endpoints are always public. Use timing-safe comparison via `validateApiKey`.

## 22) Semantic cache: stream=undefined is treated as non-streaming

`isCacheableForRead` and `isCacheableForWrite` treat `stream=undefined` as non-streaming (cacheable).
Previously this was always a cache miss. If you touch the cache eligibility logic, preserve this behavior.

## 23) headerActionStore for page-level header buttons

Page-level action buttons (e.g. "Connected Only" toggle on /providers) are registered via
`src/store/headerActionStore.js`. Do not render them inline in the Header component.
Register in a `useEffect` and clean up on unmount.

## 24) Media provider URL segments are camelCase

`/media-providers/webSearch` and `/media-providers/webFetch` use camelCase.
Kebab-case variants (`web-search`, `web-fetch`) redirect to camelCase.
Do not create new kebab-case sub-routes under `/media-providers`.

## 25) Blackbox and MiniMax are supported providers

Blackbox (LLM) and MiniMax (TTS) are supported as of v0.0.6.
Do not treat them as unknown providers when encountered in provider config or routing code.

## 26) `text-primary-fg` required when text sits on `bg-primary`

`--color-primary` flips: near-black (`#111111`) in light theme, near-white (`#e5e5e6`) in dark theme.
Using `text-white` with `bg-primary` produces unreadable white-on-white in dark mode.
Always pair `bg-primary` with `text-primary-fg` (the dedicated foreground token).
This applies to buttons, badges, chips, and any element using `bg-primary` as background.

## 27) Semantic cache now covers streaming requests

`isCacheableForRead` and `isCacheableForWrite` no longer exclude `stream: true` requests.
Streaming responses are written to cache inside `onStreamComplete` in `open-sse/handlers/chatCore.js`.
Cache hits for streaming clients are served as SSE chunks via `buildCacheHitSSEResponse`.
Do not re-add a `stream: true` guard to the cache eligibility functions — it was the root cause of 0% hit rate.

## 28) Provider node rename: custom nodes only, prefix must be preserved

`renameProviderNode(oldId, newId)` and `PATCH /api/provider-nodes/[id]/rename` only accept custom nodes.
Built-in provider IDs (`openai`, `anthropic`, `gemini`, `codex`, etc.) are hardcoded in routing handlers and must never be renamed.
The new id must start with the same type prefix (`openai-compatible-`, `anthropic-compatible-`, `custom-embedding-`).
The function is a single SQLite transaction — partial renames cannot occur.

## 29) `previousIds[]` enables permanent URL bookmark redirect for renamed providers

Every rename appends the old id to `node.data.previousIds[]`.
`ProviderDetailClient` checks this array when a node lookup by URL id returns nothing, then calls `router.replace` to the current id.
Do not clear `previousIds` — it is the redirect map for all historical bookmarks.

## 30) Request log cap is 10 000 rows

`LOG_MAX_ROWS = 10000` in `src/lib/usageDb.js`. The `/api/usage/request-logs` endpoint cap is also 10 000.
Do not lower these values without updating both locations together.

## 31) Console Logs lines are stored as `{ line, receivedAt }` objects

`ConsoleLogClient` wraps every incoming log string as `{ line: string, receivedAt: string }` via `wrapLine()`.
`LogLine` uses `parseTimestamp(line) || receivedAt` for display — lines without a `[HH:MM:SS]` prefix show the receive time instead of `—`.
Do not pass raw strings into the logs state array; always use `wrapLine()`.

## 32) SSE endpoints must attach an abort listener

Every SSE endpoint that uses `setInterval` or `setTimeout` must attach:
```js
request.signal.addEventListener("abort", cleanup)
```
Omitting this orphans timers on client disconnect and causes unbounded memory growth.
`proxy-pools/stream` and `request-logs/stream` were the source of a 1.2GB leak fixed in v0.0.13.

## 33) SQLite pragma sizing

`connection.js` sets `mmap_size = 64MB` and `cache_size = 16MB`.
Do not raise these without profiling — the previous values (256MB / 64MB) contributed to the v0.0.13 memory leak.

## 34) `usage_history` is trimmed automatically

`USAGE_HISTORY_MAX_DAYS = 90` in `src/lib/usageDb.js`. Trim runs every 100 inserts.
`getUsageHistory()` default LIMIT is 10 000. Do not remove the trim or raise the retention window without considering DB growth.

## 35) `bun --smol` has been removed from Docker

`Dockerfile` CMD is now `bun /app/server.js` (no `--smol`).
Memory is bounded instead via env vars set in the Dockerfile:
- `SEMANTIC_CACHE_MAX_BYTES=2097152` (2MB)
- `SEMANTIC_CACHE_MAX_SIZE=50`
- `PROMPT_CACHE_MAX_BYTES=1048576` (1MB)
- `PROMPT_CACHE_MAX_SIZE=25`

Do not re-add `--smol` — it throttles the heap globally and hurts throughput under load.

## 36) Semantic cache temperature threshold is `> 1`, not `!== 0`

`isCacheableForRead` and `isCacheableForWrite` skip caching when `temperature > 1`.
The previous guard (`temperature !== 0`) caused near-zero cache hit rates because most clients send `temperature: 1` by default.
Do not revert to `!== 0`.

## 38) Semantic cache write must use pre-injection signature

`generateSignature()` is called **before** `injectMemory()` mutates `body.messages`.
All write paths in `chatCore.js` must reuse `cacheSignature` (computed at read time),
not recompute from `body.messages` — which by write time contains injected memory.
Recomputing causes read/write signature mismatch → 0% hit rate.

## 39) Custom provider nodes support multiple API keys

As of v0.0.17, the single-connection limit for `openai-compatible-*`, `anthropic-compatible-*`,
and `custom-embedding-*` nodes has been removed. Multiple connections (API keys) per node
are now allowed, same as built-in providers like Kiro and Codex.

## 40) Combos and provider connections support drag-to-reorder

`/combos` list and `/providers/[id]` connection list both support drag-to-reorder via `@dnd-kit`.
- Combos: `PATCH /api/combos` with `{ order: string[] }` saves sort order to `sort_order` column.
- Connections: `PUT /api/providers/:id` with `{ priority: number }` per connection.

## 41) Minimum lockout time is configurable

`settings.minimumLockoutMinutes` (default `0` = disabled) sets a floor for model lockout duration.
When set, `markAccountUnavailable` applies `Math.max(minimumLockoutMs * backoffLevel, cooldownMs)`.
Backoff multiplier: 1x on first failure, 2x on second, 3x on third, etc.
Configured via Settings → Routing Strategy → Minimum Lockout Time.

## 42) Refresh buttons use size-7 square style

All Refresh buttons across the app use the `/logs` standard:
```jsx
<button className="flex items-center justify-center size-7 rounded-[4px] border border-charcoal-grey
  text-storm-cloud hover:bg-deep-slate hover:text-porcelain transition-colors duration-100
  disabled:opacity-50 disabled:cursor-not-allowed">
  <span className={`material-symbols-outlined text-[15px] ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
</button>
```
Do not use `<Button size="sm" icon="refresh" />` for standalone refresh actions.

## 43) `node:` protocol imports break webpack bundling

Next.js webpack cannot resolve `node:os`, `node:path`, etc. in files that are imported
by client-side or shared code. Use bare specifiers (`"os"`, `"path"`) in `open-sse/config/*`
and any file that may be bundled by webpack. `node:` protocol is fine in pure server-side
API routes and Node.js-only modules.

`renameProviderNode` appends the old id to `node.data.previousIds[]` on every rename.
`ProviderDetailClient` uses this array to redirect stale bookmark URLs to the current id via `router.replace`.
Clearing `previousIds` breaks all historical bookmarks permanently.

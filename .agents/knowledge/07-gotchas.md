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

Blackbox (LLM) and MiniMax (TTS) are supported as of v0.0.6.
Do not treat them as unknown providers when encountered in provider config or routing code.

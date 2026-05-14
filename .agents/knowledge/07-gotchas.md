# Gotchas

Read this before changing core flow.

## 1) `open-sse` is local code, not dependency

`open-sse/*` imports resolve via `jsconfig.json`. Do not install or replace with npm package versions.

## 2) `/v1/*` is rewrite-driven

`next.config.mjs` rewrites `/v1/*` to `/api/v1/*`. Do not create conflicting Next pages under `/v1`.

## 3) pnpm-only workflow

Use pnpm for install/build/test/CI parity. Avoid npm command usage in this repo.

## 4) Public API limiter is route-wrapped

`withApiKeyRateLimit` is applied on `/api/v1/*` routes. If you add a new public POST endpoint, wire the wrapper unless explicitly exempt.

## 5) API key model now has limit fields

`api_keys` includes `limit_type`, `requests_per_minute`, `concurrent_requests`.
Do not assume all keys are unlimited.

## 6) Cache and memory are first-class features

- Cache config/state:
  - `/api/cache`
  - `/api/settings/cache-config`
- Memory config/data:
  - `/api/memory`
  - `/api/memory/[id]`
  - `/api/settings/memory`

If you touch chat pipeline, validate cache/memory behavior.

## 7) Sidebar taxonomy is intentional

Keep the grouped menu layout:
- API
- Analytics
- System

Route pages can exist without sidebar exposure (example: translator/basic-chat).

## 8) SQLite is the source of truth

Default file is `~/.9router/9router.sqlite`.
Use `localDb` / sqlite helpers instead of ad-hoc JSON state changes.

## 9) `log.warn()` caveat

`src/sse/utils/logger.js` currently does not emit `warn` logs. Prefer `log.error` or `console.warn`.

## 10) CI lint step is non-blocking

`ci.yml` currently runs `pnpm exec eslint . || true`. Do not assume lint failure blocks CI.

## 11) Docker publishing target

Release images publish to Docker Hub `lazuardytech/9router` via tag `v*`.
Do not document GHCR for this repo.

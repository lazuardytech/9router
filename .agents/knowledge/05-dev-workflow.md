# Development Workflow

## Package manager

**pnpm**. Config: `.npmrc` with `node-linker=hoisted`. Install:

```bash
pnpm install              # install deps (no --frozen-lockfile for dev)
pnpm install --frozen-lockfile  # CI/Docker
```

`paseo.json` at root for [Paseo](https://paseo.dev) worktree integration.

## Run / Build

`package.json:6-14`:

```bash
pnpm run dev          # next dev --webpack --port 20128
pnpm run build        # NODE_ENV=production next build --webpack
pnpm run start        # NODE_ENV=production next start  (no --port; uses $PORT or 3000)
pnpm run dev:bun      # bun --bun next dev --webpack --port 20128
pnpm run build:bun    # bun --bun next build (prod)
pnpm run start:bun    # bun ./.next/standalone/server.js
```

**Default dev port: 20128.** Hardcoded in `package.json:7,10` and skills docs. Production `next start` does NOT set port — relies on `$PORT` env or 3000 default. Mismatch is a known gotcha.

## Lint / Typecheck / Test

| Task | Command | Notes |
|---|---|---|
| Lint | `pnpm exec eslint .` | Flat config in `eslint.config.mjs`, extends `eslint-config-next/core-web-vitals` |
| Typecheck | none | Pure JS. Only `jsconfig.json`, no TS |
| Tests | `pnpm run test:run` | Vitest via root `vitest.config.mjs`. Single-fork pool. Deps via pnpm. |

18 unit files in `tests/unit/` (17 + `sqlite-migration.test.js`): embeddings (core+cloud), claude header forwarding, codex image/refresh, combo routing, image-gen, oauth-cursor import, openai↔claude translation, perplexity-web, provider validation, rtk (3 incl. e2e + multi-provider e2e), translator normalization, web-cookie validation, antigravity-cache, sqlite-migration.

`tester/translator/testFromFile.js` = standalone manual translator harness, NOT Vitest.

Root `vitest.config.mjs` uses `vite-tsconfig-paths` for `@/` alias resolution. Pool: `forks` with `singleFork: true` (SQLite migration test requires isolation).

## Docker

```bash
# Convenience (builds & runs):
./start.sh

# Manual:
docker build -t 9router .
docker run -d -p 20128:20128 -v "$HOME/.9router:/app/data" -e DATA_DIR=/app/data --name 9router 9router
```

- Base: `oven/bun:1.3.2-alpine`
- Multi-stage: builder (nodejs/pnpm/python3/g++ for native deps) → runner
- Builder enables pnpm via Corepack, then runs `pnpm install --frozen-lockfile`
- Standalone Next output + `open-sse/` + `src/mitm/` copied separately (Next standalone tracing misses them)
- `node-forge` copied separately for MITM cert gen
- `su-exec` drops to `bun` user after chowning `/app/data`
- Volume: `9router-data` named volume → `/app/data`, `DATA_DIR=/app/data`

## CI/CD

Two workflows:

### `.github/workflows/ci.yml` (lint + test + build)
- **Trigger**: push/PR (any branch)
- Steps: pnpm install → lint (`pnpm exec eslint . || true`) → install test deps → `pnpm run test:run` → `pnpm run build`
- pnpm via `pnpm/action-setup@v4` (v10)

### `.github/workflows/docker-publish.yml`
- **Trigger**: push tags `v*` + manual `workflow_dispatch`
- NO lint/test gate (separate CI)
- Builds & pushes to `ghcr.io/<repo>` via buildx, `linux/amd64`, registry buildcache
- Tags: SHA, `{{version}}`, `{{major}}.{{minor}}`, `latest` (always, not just on default branch)
- Release process: git tag `vX.Y.Z` → image published. Manual version bump in `package.json`.

## Env vars (`.env.example`)

### Required
- `JWT_SECRET` — auth token signing (default `9router-default-secret-change-me` is **insecure**, change it!)
- `INITIAL_PASSWORD` — bootstrap admin pwd
- `DATA_DIR` — db/state location (defaults to `~/.9router/`)

### Server
- `PORT` (default 20128 in dev only), `NODE_ENV`, `BASE_URL`, `HOSTNAME`

### Auth/security
- `API_KEY_SECRET`, `MACHINE_ID_SALT`, `AUTH_COOKIE_SECURE`, `REQUIRE_API_KEY`

### Ops/observability
- `ENABLE_REQUEST_LOGS`, `OBSERVABILITY_ENABLED`
- `API_TIMEOUT_MS` — upstream request timeout (default 45000ms, used in `chatCore.js:158`)

### Cloud sync
- `CLOUD_URL` / `NEXT_PUBLIC_CLOUD_URL`, `NEXT_PUBLIC_BASE_URL`

### Outbound proxy (upstream provider calls)
- `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY` (lowercase variants honored)

## i18n

**Two layers:**

1. **README translations** (`i18n/`): `README.ja-JP.md`, `README.vi.md`, `README.zh-CN.md` — static
2. **App runtime i18n**: `src/i18n/config.js:1` defines 33 locales; `src/i18n/runtime.js:27` fetches `/i18n/literals/${locale}.json` at runtime, DOM-walks translating text nodes; opt-out via `data-i18n-skip` attribute. Locale persisted in `locale` cookie.

32 JSON literal files in `public/i18n/literals/` (en is source, no JSON file).

## Submodules

`.gitmodules` — single private:
```
[submodule "src/mitm/dev"]
  path = src/mitm/dev
  url  = https://github.com/decolua/9router-dev.git
```

Closed-source MITM dev/debug helper.

## SQLite migration

Auto-migration from legacy `db.json` runs on first boot (`src/lib/sqlite/connection.js:72-80`). Manual trigger:

```bash
curl -X POST http://localhost:20128/api/settings/migrate-sqlite
curl http://localhost:20128/api/settings/migrate-sqlite  # GET to inspect
```

One-off script: `node scripts/migrate-json-to-sqlite.mjs` (standalone, outside Next).

## Versioning

- Source: `package.json:3` (currently `0.4.24`)
- Bump: manual
- Format `CHANGELOG.md`: `# vX.Y.Z (YYYY-MM-DD)` then `## Features / Improvements / Fixes`. Plain markdown, NOT Keep-a-Changelog.
- Cadence: ~daily releases since mid-Apr 2026, fast-moving.

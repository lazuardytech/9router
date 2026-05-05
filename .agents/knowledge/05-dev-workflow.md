# Development Workflow

## Run / Build

`package.json:6-13`:

```bash
npm run dev          # next dev --webpack --port 20128
npm run build        # NODE_ENV=production next build --webpack
npm start            # NODE_ENV=production next start  (no --port; uses $PORT or 3000)
npm run dev:bun      # bun --bun next dev --webpack --port 20128
npm run build:bun    # bun --bun next build (prod)
npm run start:bun    # bun ./.next/standalone/server.js
```

**Default dev port: 20128.** Hardcoded in `package.json:7,10` and skills docs. Production `next start` does NOT set port — relies on `$PORT` env or 3000 default. Mismatch is a known gotcha.

## Lint / Typecheck / Test

| Task | Command | Notes |
|---|---|---|
| Lint | `npx eslint .` | No npm script. Flat config in `eslint.config.mjs`, extends `eslint-config-next/core-web-vitals` |
| Typecheck | none | Pure JS. Only `jsconfig.json`, no TS |
| Tests | `cd tests && npm test` | Vitest. **Deps live in `/tmp/node_modules`** to dodge Next workspace hoist. Script: `NODE_PATH=/tmp/node_modules /tmp/node_modules/.bin/vitest run` |

17 unit files in `tests/unit/`: embeddings (core+cloud), claude header forwarding, codex image/refresh, combo routing, image-gen, oauth-cursor import, openai↔claude translation, perplexity-web, provider validation, rtk (3 incl. e2e + multi-provider e2e), translator normalization, web-cookie validation, antigravity-cache.

`tester/translator/testFromFile.js` = standalone manual translator harness, NOT Vitest.

## Docker

```bash
# Convenience (builds & runs):
./start.sh

# Manual:
docker build -t 9router .
docker run -d -p 20128:20128 -v "$HOME/.9router:/app/data" -e DATA_DIR=/app/data --name 9router 9router
```

- Base: `oven/bun:1.3.2-alpine`
- Multi-stage: builder (nodejs/npm/python3/g++ for native deps) → runner
- Standalone Next output + `open-sse/` + `src/mitm/` copied separately (Next standalone tracing misses them)
- `node-forge` copied separately for MITM cert gen
- `su-exec` drops to `bun` user after chowning `/app/data`
- Volume: `9router-data` named volume → `/app/data`, `DATA_DIR=/app/data`

## CI/CD

`.github/workflows/docker-publish.yml`:
- **Trigger**: push tags `v*` + manual `workflow_dispatch`
- **NO PR/push CI** → no automated lint/test gate
- Builds & pushes to `ghcr.io/<repo>` via buildx, `linux/amd64`, registry buildcache
- Tags: SHA, `{{version}}`, `{{major}}.{{minor}}`, `latest` on default branch
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

## Versioning

- Source: `package.json:3` (currently `0.4.18`)
- Bump: manual
- Format `CHANGELOG.md`: `# vX.Y.Z (YYYY-MM-DD)` then `## Features / Improvements / Fixes`. Plain markdown, NOT Keep-a-Changelog.
- Cadence: ~daily releases since mid-Apr 2026, fast-moving.

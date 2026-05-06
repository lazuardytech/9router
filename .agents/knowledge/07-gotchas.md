# Gotchas

Things that will trip up a new contributor (human or AI). Read before editing anything non-trivial.

## 1. `open-sse` is NOT an npm dep

Imported as bare `open-sse/...` (e.g. `chat.js:1`, `completions/route.js:3`) but it's a **local in-repo package**, NOT in `package.json`. Aliased via `jsconfig.json:6-7`. Has its own folder layout (`config/`, `executors/`, `handlers/`, `rtk/`, `services/`, `transformer/`, `translator/`, `utils/`); `index.js` is a barrel re-export. **No dist step — edits are live.** Don't `npm install open-sse`.

## 2. Hardcoded port 20128 (with prod mismatch)

- Dev/start scripts: `package.json:7,10`
- Skills docs: `skills/9router/SKILL.md:13`, `skills/README.md:33`
- Docker: `start.sh:4`, `Dockerfile`

But **`npm start` (production `next start`) does NOT pass `--port`** (`package.json:9`) — it falls back to `$PORT` env or Next's default `3000`. Mismatch with documented 20128.

## 3. Two middleware-style files

`src/proxy.js` (Next middleware matcher config) re-exports `proxy` from `src/dashboardGuard.js`. The actual auth/redirect logic is in `dashboardGuard.js`. **Both files have `config` exports** — only one is used. If you edit middleware matchers, check both.

## 4. Default JWT secret is insecure

`dashboardGuard.js:7` falls back to `"9router-default-secret-change-me"` when `JWT_SECRET` env is absent. Don't deploy without setting it.

## 5. CLI auth bypass via machine-id

`x-9r-cli-token` header derived from `getConsistentMachineId("9r-cli-auth")` (`dashboardGuard.js:10-23`) skips JWT entirely on protected routes. Local-only by design — anything that can read machine-id can call `/api/shutdown`. Don't assume protected routes are JWT-only.

## 6. Next rewrites collapse all `/v1/*`

`next.config.mjs:22-44`:
- `/v1/*` → `/api/v1/*`
- `/v1/v1/*` → `/api/v1/*` (double-prefix collapse)
- `/codex/:path*` → `/api/v1/responses` regardless of subpath

**Don't add `/v1/*` Next pages** — they'll be shadowed by API routes.

## 7. `better-sqlite3` is optional

`package.json:43-45` lists it under `optionalDependencies` and `next.config.mjs:4` marks it `serverExternalPackages` (so native binding isn't bundled). Code falls back to `sql.js` / `lowdb` when native build fails. **Don't hard-import it.** Currently only used in `src/app/api/oauth/cursor/auto-import/route.js` for reading Cursor's SQLite (with `sqlite3` CLI fallback).

## 8. MITM bootstrap = ESM→CJS bridged via env var

`process.env.MITM_SERVER_PATH` is set inside an IIFE BEFORE the manager (CJS) is initialized (`initializeApp.js:22-32`). DB hooks injected via `initDbHooks(getSettings, updateSettings)` to avoid circular imports. If you touch MITM init, preserve this ordering.

## 9. Singleton survives Next HMR

`global.__appSingleton ??= {…}` (`initializeApp.js:37-44`) protects long-lived intervals (watchdog, network monitor) from re-registration. **If you add similar singletons, follow this pattern** or you'll get duplicate timers in dev.

## 10. `page.new.js` checked in

`src/app/(dashboard)/dashboard/providers/[id]/page.new.js` exists alongside the live `page.js`. Looks like a WIP scratch file. Verify before assuming it's wired up.

## 11. `fs: "^0.0.1-security"` in deps

`package.json:20` lists `fs` (a placeholder/squat package — Node's `fs` is built-in). Harmless but odd. Don't remove without testing — some bundler resolution might rely on it.

## 12. `log.warn()` is silently disabled

`src/sse/utils/logger.js:43` body is commented-out. Calls produce no output. Use `log.error` or `console.warn` directly.

## 13. Naming: code says "9router", repo says "melma-router"

- Package name: `9router-app`
- Data dir: `~/.9router/`
- Env: `NINEROUTER_*` in skills
- Skills GitHub repo URL: `decolua/9router` (hardcoded in `src/shared/constants/skills.js:9`)
- npm CLI tool: not present here, but referenced

Only the README + repo name say "melma-router". **Don't blanket-rename** — coordinate first. Skills metadata pulls from `decolua/9router` GitHub raw — changing this would require forking skills and updating `SKILLS_RAW_BASE`.

## 14. Account "Mongo-style" `_id` is lowdb

Zustand stores use `_id` for record IDs (`providerStore.js:18,24`) but backing store is **lowdb JSON files**, not MongoDB. Don't try to query MongoDB — just edit `db.json` via `localDb.js`.

## 15. `tests/` is an isolated subpackage

Vitest deps live in **`/tmp/node_modules`** (`tests/package.json:8` script: `NODE_PATH=/tmp/node_modules ...`) to dodge Next workspace hoist. To run tests: `cd tests && npm test`. To install test deps: check `tests/package.json`.

## 16. CI runs only on tag push

`.github/workflows/docker-publish.yml` triggers on `v*` tag push + manual. **NO PR/push CI** — no automated lint/test gate. Run locally before pushing.

**Note**: There is also a separate CI workflow (`.github/workflows/ci.yml`) that runs lint, test, and build validation on PR/push, but Docker publish only happens on tag push.

## 17. Cooldown is per-MODEL, not per-account

`src/sse/services/auth.js:198` `markAccountUnavailable` writes `modelLock_${model}` key. So if account A fails on `gemini-3-pro`, the lock applies to that model, and account A might still be tried for `gemini-2-flash`. Counter-intuitive — read `accountFallback.js:23` `checkFallbackError` carefully when debugging.

## 18. Skills changes need GitHub commit to master

`SKILLS_RAW_BASE = https://raw.githubusercontent.com/decolua/9router/refs/heads/master/skills` (`src/shared/constants/skills.js:9`). Adding/editing skills requires:
1. Folder + `SKILL.md` in `skills/`
2. Entry in `SKILLS` array in `src/shared/constants/skills.js:12-70`
3. Push to `decolua/9router@master` for the link to resolve

**For melma-router**, this URL is wrong (points at upstream). Consider whether to fork skills hosting.

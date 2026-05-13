# Gotchas

Things that will trip up a new contributor (human or AI). Read before editing anything non-trivial.

## 1. `open-sse` is NOT an npm dep

Imported as bare `open-sse/...` (e.g. `chat.js:1`, `completions/route.js:3`) but it's a **local in-repo package**, NOT in `package.json`. Aliased via `jsconfig.json:6-7`. Has its own folder layout (`config/`, `executors/`, `handlers/`, `rtk/`, `services/`, `transformer/`, `translator/`, `utils/`); `index.js` is a barrel re-export. **No dist step — edits are live.** Do not install `open-sse` from the registry.

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

## 7. SQLite is now the primary store (was optional)

`better-sqlite3` is in `optionalDependencies` — still optional. But now **SQLite is the primary store** (`~/.9router/9router.sqlite`), NOT lowdb JSON. On Node: `better-sqlite3`. On Bun: `bun:sqlite` (built-in, via `createRequire`). Both are externals in `next.config.mjs`. Code falls back to in-memory lowdb only on Cloudflare Workers (`isCloud` check).

Legacy `db.json` is auto-migrated on first boot. Don't hard-import `better-sqlite3` directly — use `src/lib/sqlite/connection.js:82` `getDatabase()` which handles runtime detection.

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

## 13. Naming: "9router" internally, "9router" externally (intentional)

This is the established convention (see `AGENTS.md`), not an oversight:

- Package name: `9router-app`
- Data dir: `~/.9router/`
- Env: `NINEROUTER_*` in skills
- Skills GitHub repo URL: `decolua/9router` (hardcoded in `src/shared/constants/skills.js:9`)
- npm CLI tool: not present here, but referenced

"9router" is used only for external/repo context (README, repo name, GitHub URL). Do not blanket-rename internal 9router references. Skills metadata pulls from `decolua/9router` GitHub raw — changing this would require forking skills and updating `SKILLS_RAW_BASE`.

## 14. Account "Mongo-style" `_id` is SQLite

Zustand stores use `_id` for record IDs (`providerStore.js:18,24`) but backing store is **SQLite**, not MongoDB. Don't try to query MongoDB. Edit via `localDb.js` (which wraps SQLite). You can also query directly: `sqlite3 ~/.9router/9router.sqlite "SELECT * FROM provider_connections"`.

## 15. Tests use root vitest config + pnpm

Tests now run via `pnpm run test:run` which uses the root `vitest.config.mjs` (single-fork pool, `vite-tsconfig-paths` plugin). Install test deps via `pnpm install` at root.

Root `vitest.config.mjs` uses `pool: "forks"` with `singleFork: true` — SQLite migration test mutates `process.env.DATA_DIR` and needs isolation from other suites.

## 16. CI runs on push/PR and tag push (two workflows)

Two CI workflows:
- **`.github/workflows/ci.yml`** — lint + test + build on **push/PR** (any branch). Uses pnpm.
- **`.github/workflows/docker-publish.yml`** — Docker build+push on `v*` tag push + manual. `latest` tag emitted on every build (not just default branch).

`ci.yml` removed the `|| true` on lint — failures now fail the pipeline. Reports: `pnpm run test:run` and `pnpm run build`.

## 17. Cooldown is per-MODEL, not per-account

`src/sse/services/auth.js:198` `markAccountUnavailable` writes `modelLock_${model}` key. So if account A fails on `gemini-3-pro`, the lock applies to that model, and account A might still be tried for `gemini-2-flash`. Counter-intuitive — read `accountFallback.js:23` `checkFallbackError` carefully when debugging.

## 18. Skills changes need GitHub commit to master

`SKILLS_RAW_BASE = https://raw.githubusercontent.com/decolua/9router/refs/heads/master/skills` (`src/shared/constants/skills.js:9`). Adding/editing skills requires:
1. Folder + `SKILL.md` in `skills/`
2. Entry in `SKILLS` array in `src/shared/constants/skills.js:12-70`
3. Push to `decolua/9router@master` for the link to resolve

**For 9router**, this URL is wrong (points at upstream). Consider whether to fork skills hosting.

## 19. pnpm-only dependency workflow

Package manager is pnpm. `.npmrc` sets `node-linker=hoisted` for compatibility. `pnpm-lock.yaml` is committed. Use `pnpm install` and `pnpm run ...` for all local, CI, and Docker workflows.

`better-sqlite3` is in `pnpm.onlyBuiltDependencies` in `package.json` so its native bindings compile. If you add a new native dep, add it to this list.

`paseo.json` exists for [Paseo](https://paseo.dev) worktree — ignore if not using it.

## 20. Upstream timeout: 408 ≠ 499

`chatCore.js:158-190` introduces a combined `AbortController` for both client disconnect and upstream timeout:
- Client closes connection → 499
- Upstream timeout (`API_TIMEOUT_MS`, default 45000ms) → 408 (Request Timeout)
- 502/503 retries: 2 attempts @ 1500ms each (was 3 @ 3000ms)
- 504: no retry (0 attempts)

The `LOCAL_UPSTREAM_TIMEOUT_MS = 45000` constant is in `open-sse/config/runtimeConfig.js:49`.

## 21. Exit flush hooks for buffered queues

`usageDb.js:340-348` registers `beforeExit`, `SIGINT`, `SIGTERM`, and `exit` handlers that flush `summaryQueue` and `logQueue`. Guarded by `global._flushHooksRegistered`. If you add buffered queues elsewhere, follow this pattern.

## 22. Claude tool name decloaking runs on every SSE line

`open-sse/utils/claudeCloaking.js` `decloakToolNames()` is a recursive shape-agnostic walker applied per SSE line in `stream.js`. It also strips `CLAUDE_TOOL_SUFFIX` (`_9r`) from tool names for Claude provider passthrough. When debugging missing tool calls, check if the decloaking is stripping names you expect.

## 23. NineRemote promo components removed

`NineRemoteButton.js`, `NineRemotePromoModal.js`, and the "Remote" menu item in `HeaderMenu.js` were deleted. No replacement. If you see references to NineRemote promo in old commits, ignore — not coming back.

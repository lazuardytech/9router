# AGENTS.md

Operational notes for AI agents working on **9router** (`/workspace/9router`).

## Current Baseline

- Release baseline: **v0.3.1**
- Key recent features:
  - Semantic cache (`semantic_cache`, `cache_metrics`)
  - Conversational memory (`memories`, `memory_fts`)
  - Per-API-key rate limit modes (`unlimited` / `limited`)
  - Dashboard IA update:
    - API: Endpoint, LLM Providers, Media Providers, Combos, Memory, Cache
    - Analytics: Usage, Quota
    - System: Proxy Pools, Console Log, Settings

## Non-Negotiable Rules

1. **pnpm only**
   - Use `pnpm` for install/run/test/build.
   - Do not use `npm` commands in this repo workflow.
2. **Keep internal naming as `9router`**
   - Package, DB filename, and data dir conventions remain `9router`.
3. **`open-sse` is local source**
   - Imported through `jsconfig.json` aliases.
   - Do not install `open-sse` from npm.
4. **Use storage facade**
   - Prefer `src/lib/localDb.js` and `src/lib/sqlite/connection.js`.
   - Avoid direct hard-coupled imports of `better-sqlite3` in feature code.

## Verification Before Push

- `pnpm run test:run`
- `pnpm run build`

Run lint when touching broad UI/shared code:
- `pnpm exec eslint .`

## CI / Release

- CI workflow name: **Build & Test**
- Docker workflow name: **Build & Push Docker Image**
- Docker image target: `docker.io/lazuardytech/9router`
- Publish trigger: push tag `v*` (example: `v0.3.1`)

## Docs Map

- Entry: `.agents/INDEX.md`
- Architecture: `.agents/knowledge/02-architecture.md`
- API map: `.agents/knowledge/04-api-surface.md`
- Gotchas: `.agents/knowledge/07-gotchas.md`

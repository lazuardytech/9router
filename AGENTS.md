# AGENTS.md

Operational notes for AI agents working on **Pod** (`~/projects/lt/pod`).

## Current Baseline

- Release baseline: **v0.0.11**
- Package: `pod`
- Docker: `lazuardytech/pod` (tags v0.0.1–v0.0.11, latest)
- GitHub: `lazuardytech/pod`, branch `main`
- Data dir: `~/.pod/pod.sqlite`

## Non-Negotiable Rules

1. **bun only** — use `bun` for install/run/test/build. Never npm or pnpm.
2. **Keep internal naming as `pod`** — package, DB filename, data dir, Docker image.
3. **`open-sse` is local source** — imported via `jsconfig.json` aliases. Do not install from npm.
4. **Use storage facade** — prefer `src/lib/localDb.js` and `src/lib/sqlite/connection.js`.
5. **No browser `confirm()`** — always use `ConfirmModal` from `@/shared/components/Modal`.
6. **No `/dashboard` prefix** — all routes are top-level (`/endpoint`, `/providers`, etc.).
7. **Bump both version fields together** — `package.json` AND `src/shared/constants/config.js` `displayVersion`.
8. **Page-level header actions go through `headerActionStore`** — register buttons via `src/store/headerActionStore.js`, not inline in page components.
9. **API key auth on model listing endpoints** — `GET /v1/models`, `GET /v1/models/[kind]`, `GET /v1beta/models` enforce auth when `requireApiKey=true`. Do not bypass.
10. **SSE endpoints use `open-sse` stream helpers** — `/api/usage/request-logs/stream` and `/api/proxy-pools/stream` follow the same SSE pattern as console logs.
11. **`text-primary-fg` for text on `bg-primary`** — never use `text-white` or `text-black` with `bg-primary`. The `--color-primary` token flips between near-black (light) and near-white (dark); `text-primary-fg` is the paired foreground token that stays readable in both themes.
12. **Provider node rename is custom-only** — `renameProviderNode` and `PATCH /api/provider-nodes/[id]/rename` only work on custom nodes (`openai-compatible-*`, `anthropic-compatible-*`, `custom-embedding-*`). Built-in provider IDs are hardcoded in routing and must never be renamed.
13. **Streaming requests are now cached** — `isCacheableForRead/Write` no longer blocks `stream: true`. Cache hits for streaming clients are served as SSE chunks via `buildCacheHitSSEResponse`. Do not re-add the `stream: true` exclusion.

## Verification Before Push

```bash
bun run format     # biome format --write .
bun x eslint .     # lint check
bun run test:run   # vitest
bun run build      # next build
```

## CI / Release

- CI workflow: `.github/workflows/ci.yml` — **Build & Test**
- Docker workflow: `.github/workflows/docker-publish.yml` — **Build & Push Docker Image**
- Docker image: `docker.io/lazuardytech/pod`
- Publish trigger: push tag `v*` (e.g. `v0.0.5`)
- RWX build: `rwx run .rwx/build.yml`

## Docs Map

- Entry: `.agents/INDEX.md`
- Overview: `.agents/knowledge/01-overview.md`
- Architecture: `.agents/knowledge/02-architecture.md`
- Providers & Routing: `.agents/knowledge/03-providers-and-routing.md`
- API Surface: `.agents/knowledge/04-api-surface.md`
- Dev Workflow: `.agents/knowledge/05-dev-workflow.md`
- Conventions: `.agents/knowledge/06-conventions.md`
- Gotchas: `.agents/knowledge/07-gotchas.md`
- Skills System: `.agents/knowledge/08-skills-system.md`
- Fork Status: `.agents/knowledge/09-fork-status.md`

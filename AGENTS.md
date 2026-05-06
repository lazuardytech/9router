# AGENTS.md

Documentation for AI agents working on **melma-router** (an internal Lazuardy Tech project, forked from [decolua/9router](https://github.com/decolua/9router)).

> **⚠️ MANDATORY RULES**: Read [`.opencode/rules/mandatory.md`](.opencode/rules/mandatory.md) first — contains critical response rules, subagent policies, and sacred project conventions.

## Read first

Before editing anything non-trivial, read:

1. **[`.agents/knowledge/01-overview.md`](.agents/knowledge/01-overview.md)** — what this project is, stack, repo layout
2. **[`.agents/knowledge/02-architecture.md`](.agents/knowledge/02-architecture.md)** — boot flow, request flow, fallback layers, storage
3. **[`.agents/knowledge/07-gotchas.md`](.agents/knowledge/07-gotchas.md)** — non-obvious traps (READ THIS, seriously)

For deeper topics:

- **[`.agents/knowledge/03-providers-and-routing.md`](.agents/knowledge/03-providers-and-routing.md)** — provider catalog, executors, routing decision flow, RTK
- **[`.agents/knowledge/04-api-surface.md`](.agents/knowledge/04-api-surface.md)** — OpenAI/Anthropic/Gemini/Ollama-compat endpoints, mgmt API
- **[`.agents/knowledge/05-dev-workflow.md`](.agents/knowledge/05-dev-workflow.md)** — run/build/lint/test/Docker/CI commands + env vars
- **[`.agents/knowledge/06-conventions.md`](.agents/knowledge/06-conventions.md)** — code style, naming, error handling, logging
- **[`.agents/knowledge/08-skills-system.md`](.agents/knowledge/08-skills-system.md)** — `skills/` markdown specs + dashboard page
- **[`.agents/knowledge/09-fork-status.md`](.agents/knowledge/09-fork-status.md)** — relation to upstream, sync workflow

Authoritative deep-dive: `docs/ARCHITECTURE.md` (557 lines, written by upstream maintainers).

## TL;DR for a new agent

- **Stack**: Next.js 16 + React 19 + Tailwind v4, pure JS ESM (no TS), zustand, **SQLite-backed** (better-sqlite3 / bun:sqlite), runs on Bun in prod
- **Two packages**: `src/` (app) + `open-sse/` (router engine, local-aliased not npm)
- **Package manager**: **pnpm** (migrated from npm). Uses `node-linker=hoisted`.
- **Dev port**: `20128`
- **Lint**: `pnpm exec eslint .` or `npx eslint .` (no npm script)
- **Test**: `npm run test:run` (vitest, deps via pnpm). Root `vitest.config.mjs` + single-fork pool.
- **Run**: `npm run dev` or `npm run dev:bun`
- **Storage**: `~/.9router/9router.sqlite` (SQLite). Legacy `db.json` auto-migrated on first boot.
- **Config**: read `.env.example` for required env (`JWT_SECRET`, `INITIAL_PASSWORD`, `DATA_DIR`)

## When in doubt

- Search `docs/ARCHITECTURE.md` first — most "how does X work" answers live there
- For routing/translator behavior: read `open-sse/handlers/chatCore.js` end-to-end
- For auth/credential selection: `src/sse/services/auth.js`
- For DB schema: `src/lib/sqlite/schema.js` (SQLite) and `src/lib/localDb.js` (facade)

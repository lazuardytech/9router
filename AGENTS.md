# AGENTS.md

Documentation for AI agents working on **melma-router** (an internal Lazuardy Tech project, forked from [decolua/9router](https://github.com/decolua/9router)).

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

- **Stack**: Next.js 16 + React 19 + Tailwind v4, pure JS ESM (no TS), zustand, lowdb storage, runs on Bun in prod
- **Two packages**: `src/` (app) + `open-sse/` (router engine, local-aliased not npm)
- **Dev port**: `20128`
- **Lint**: `npx eslint .` (no npm script)
- **Test**: `cd tests && npm test` (vitest deps live in `/tmp/node_modules`)
- **Run**: `npm run dev` or `npm run dev:bun`
- **Storage**: `~/.9router/db.json` (lowdb)
- **Config**: read `.env.example` for required env (`JWT_SECRET`, `INITIAL_PASSWORD`, `DATA_DIR`)

## MANDATORY: use subagents

For any non-trivial work — codebase exploration, multi-file analysis, parallel research, build/refactor planning, large-scope coordination — you **MUST delegate to subagents** rather than doing it inline in the main thread.

Why: keeps the main context window clean, parallelizes independent queries, prevents single-thread token blow-up on big repos.

### Available subagents (configured in `opencode.jsonc`)

| Agent | Mode | When to use |
|---|---|---|
| `explore` / `explorer` | subagent | Codebase exploration: "find all X", "how does Y work", "map the Z system". Specify thoroughness: `quick` / `medium` / `very thorough`. |
| `general` | subagent | Multi-step research, parallel independent units of work, anything that needs a fresh context. |
| `build` | primary | Larger build/refactor sessions where you want a dedicated agent driving. |
| `plan` | primary | Planning a non-trivial change before touching code. |

If you use a different harness (Claude Code, Cursor, etc.) check its config for equivalent subagent setup. The principle stays: **delegate exploration and analysis, don't bloat the main thread.**

> **Note**: `opencode.jsonc` is git-ignored (contains tokens). If it's missing in your checkout, create one using the official opencode docs at <https://opencode.ai/docs> (config schema: <https://opencode.ai/config.json>). Mirror the agent block above (`build`, `plan`, `general`, `explore`, `explorer`) so the subagent workflow works.

### Rules of thumb

- **>3 search/grep queries needed?** → spawn an `explore` subagent.
- **Multiple independent investigations?** → spawn them **in parallel** (one message, multiple Task calls).
- **Context already getting heavy?** → spawn a subagent rather than continuing inline.
- **Trivial single-file edits, single greps, direct tool calls?** → fine to do inline. Don't over-delegate.

### Don't

- Don't spawn a subagent and then redo the same searches yourself.
- Don't spawn subagents for tasks that need only 1–2 tool calls.
- Don't skip the subagent step on big tasks just because it feels faster — it isn't.

## Working rules

1. **No comments unless asked.** Code conventions discourage them.
2. **Don't blanket-rename `9router` → `melma-router`.** Internal code still says 9router (package name, data dir, env, skills URL). Coordinate first. See gotcha #13.
3. **Don't `npm install open-sse`** — it's a local package, aliased via `jsconfig.json`.
4. **No PR/push CI** — run lint and tests locally before pushing.
5. **`/v1/*` Next pages will be shadowed** by rewrites — don't add them.
6. **`log.warn()` is silently disabled** — use `log.error` or `console.warn`.
7. **CI publishes Docker on tag push (`v*`)** — version bump is manual in `package.json`.
8. **Sync upstream**: `git fetch upstream && git merge upstream/master` (remote already configured).

## When in doubt

- Search `docs/ARCHITECTURE.md` first — most "how does X work" answers live there
- For routing/translator behavior: read `open-sse/handlers/chatCore.js` end-to-end
- For auth/credential selection: `src/sse/services/auth.js`
- For DB schema: `src/lib/localDb.js`

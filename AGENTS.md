# AGENTS.md

Documentation for AI agents working on **melma-router** (an internal Lazuardy Tech project, forked from [decolua/9router](https://github.com/decolua/9router)).

## 🚨 CRITICAL: Response Rules (READ FIRST)

### Rule #1: NO EMPTY RESPONSES

**NEVER send "..." or "…" or any placeholder text while processing.**

```
❌ FORBIDDEN:
User: "analyze the code"
Agent: "..."
Agent: <uses tools>

✅ CORRECT:
User: "analyze the code"
Agent: <uses tools immediately, no text>
```

**When to send text:**
- ✅ After tools complete, with actual findings
- ✅ Asking clarifying questions
- ✅ Reporting results

**When NOT to send text:**
- ❌ Before/during tool execution
- ❌ "Processing...", "Thinking...", "...", "…"
- ❌ Any placeholder or filler

**If you have nothing meaningful to say, DO NOT RESPOND. Just call tools directly.**

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

## Rule #2: Use Subagents for Non-Trivial Work

**WHEN to delegate to subagents:**

| Task Type | Use Subagent? | Agent Type |
|-----------|---------------|------------|
| Find all files matching pattern | ✅ YES | `explore` |
| Analyze how system X works | ✅ YES | `explore` |
| Multiple independent searches | ✅ YES | `explore` (parallel) |
| Multi-step research | ✅ YES | `general` |
| Single file edit | ❌ NO | Do inline |
| 1-2 grep queries | ❌ NO | Do inline |
| Read specific known file | ❌ NO | Do inline |

**Available subagents:**

- `explore` / `explorer` — Codebase exploration. Specify thoroughness: `quick` / `medium` / `very thorough`
- `general` — Multi-step research, parallel work
- `build` — Large refactors (primary mode)
- `plan` — Planning before implementation (primary mode)

**Quick decision tree:**

```
Need >3 searches? → explore subagent
Multiple independent tasks? → spawn parallel subagents
Single file edit? → do inline
Context getting heavy? → spawn subagent
```

## Rule #3: NO NESTED SUBAGENTS

**Subagents CANNOT spawn other subagents. Period.**

```
❌ FORBIDDEN:
Main agent → subagent A → subagent B (NEVER DO THIS)

✅ CORRECT:
Main agent → subagent A
Main agent → subagent B (parallel)
```

**If you are a subagent:**
- ✅ Use: read, grep, glob, bash, edit, write
- ❌ NEVER use: Task tool

**If subagent needs more work:**
1. Return findings to main agent
2. Main agent spawns additional subagents if needed

**Why this rule exists:** Subagents only have tools, not skills. Nesting creates complexity and violates execution model.

## Quick Reference: Common Mistakes

| ❌ DON'T | ✅ DO |
|---------|-------|
| Send "..." while processing | Call tools directly without text |
| Add code comments | Only add if user asks |
| `npm install open-sse` | It's local package (jsconfig.json) |
| Rename `9router` → `melma-router` | Keep internal names (see gotcha #13) |
| Use `log.warn()` | Use `log.error` or `console.warn` |
| Add `/v1/*` Next pages | They're shadowed by rewrites |
| Push without testing | Run lint/tests locally first |

## Working Rules

1. **No comments unless asked** — code conventions discourage them
2. **Don't rename `9router`** — internal code uses original name (package, data dir, env, skills URL). See `.agents/knowledge/07-gotchas.md` #13
3. **`open-sse` is local** — aliased via `jsconfig.json`, don't npm install
4. **Test before push** — no PR/push CI, run locally
5. **`log.warn()` disabled** — use `log.error` or `console.warn`
6. **Docker publish** — CI auto-publishes on `v*` tag push, bump `package.json` manually
7. **Sync upstream** — `git fetch upstream && git merge upstream/master`

## When in doubt

- Search `docs/ARCHITECTURE.md` first — most "how does X work" answers live there
- For routing/translator behavior: read `open-sse/handlers/chatCore.js` end-to-end
- For auth/credential selection: `src/sse/services/auth.js`
- For DB schema: `src/lib/localDb.js`

# AGENTS.md

Documentation for AI agents working on **9router** (Lazuardy Tech project, forked from [decolua/9router](https://github.com/decolua/9router)).

## Core Rules

### Response standard
- No empty responses (`...`).
- Provide meaningful content or none at all.
- Text only for clarifications, results, or findings.

### Subagent usage
- **No nested subagents.**
- Use `explore` for discovery/codebase analysis.
- Use `general` for research, parallel work, and build tasks.
- Inline tool calls for single file edits or quick greps.

### Code style
- English only, no code comments (unless requested).
- Adhere to established project style and libraries.
- No new dependencies without prior verification.

## Project Directives
1. **Naming**: Retain internal "9router" references (package names, data dirs, env vars).
2. **Local Packages**: `open-sse` is local; alias via `jsconfig.json`. Do not install from the registry.
3. **Quality**: Run `pnpm exec eslint .` and `pnpm run test:run` before push.
4. **Logging**: Use `log.error` or `console.warn`. `log.warn()` is disabled.
5. **Infrastructure**: MITM init order is critical. `process.env.MITM_SERVER_PATH` must be set before manager init.
6. **Persistence**: Use `getDatabase()` facade; no hard-imports of `better-sqlite3`.

## Quick Reference
- **Stack**: Next.js 16 + React 19 + Tailwind v4, Pure JS ESM, SQLite.
- **Packages**: `src/` (App), `open-sse/` (Engine).
- **Commands**: `pnpm run dev`, `pnpm run test:run`, `pnpm exec eslint .`.
- **Docs Entry**: `.agents/INDEX.md`.

## Workflow
1. **Read before edit.**
2. **Check `.agents/knowledge/07-gotchas.md`** before non-trivial changes.
3. **Match existing patterns.**
4. **Verify changes locally.**
5. **Keep knowledge docs current.**

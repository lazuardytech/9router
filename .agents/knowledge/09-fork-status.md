# Fork Status

## Lineage

```
CLIProxyAPI (Go)         original — by router-for-me
        ↓
9Router (JS port)        active upstream — github.com/decolua/9router
        ↓
9router             this repo — github.com/lazuardytech/9router
        ↓
OmniRoute (TS port)      sister fork — github.com/diegosouzapw/OmniRoute
```

## Sync state (as of 2026-05-07)

9router `master` HEAD = upstream `decolua/9router@master` HEAD with merged PR #794 (SQLite migration) + 10 local commits.

Upstream merge `bbc3f65` (`Merge upstream PR #794: SQLite migration for high concurrency`) — 23 files changed, ~3K lines added. SQLite-backed storage, new `src/lib/sqlite/`, rewritten `localDb.js`.

Local commits after merge: pnpm migration, upstream timeout/fallback, Claude tool decloaking, NineRemote removal, test fixes, CI overhaul, version bump to 0.4.24.

**Initial commit `3857598`** is a flat snapshot — NOT a `git fork` clone. History before `3857598` does not exist locally. To pull upstream history with full graph, would need to re-clone from upstream.

## Sync setup

Remote already configured:
```bash
git remote -v
# origin    git@github.com:lazuardytech/9router.git
# upstream  https://github.com/decolua/9router.git
```

To sync future upstream changes:
```bash
git fetch upstream
git log --oneline master..upstream/master   # check what's new
git merge upstream/master                   # merge (or rebase if preferred)
git push origin master
```

## Local divergence (what makes this 9router not 9router)

Divergence is still small but growing:

| Change | Status |
|---|---|
| `README.md` | Replaced with Lazuardy Tech notice |
| `.agents/`, `AGENTS.md` | Agent documentation |
| `pnpm` migration (`c720d3f`) | `.npmrc`, `pnpm-lock.yaml`, `paseo.json`, Docker CI changes |
| Upstream timeout/fallback (`d96ac0a`) | `LOCAL_UPSTREAM_TIMEOUT_MS`, combined AbortController |
| Claude tool decloaking (`75a84a6`) | Recursive shape-agnostic `decloakToolNames` |
| NineRemote promo removed | `NineRemoteButton.js`, modal, HeaderMenu entry deleted |
| CI overhaul (`d188511`) | `pnpm run test:run`, no `|| true`, `latest` always emitted |
| Test fixes (`c8e8d7a`) | Fixed 4 test files |

**Code references use "9router" internally, by design** (package name `9router-app`, data dir `~/.9router/`, env vars, GitHub raw URLs in `skills.js`). "9router" is used only for external/repo context. See gotcha #13 in `07-gotchas.md`.

## When merging upstream

1. `README.md` will conflict — keep ours (Lazuardy Tech notice).
2. `.agents/` and `AGENTS.md` won't conflict (don't exist upstream) — keep ours.
3. `.npmrc`, `.npxrc`, `pnpm-lock.yaml`, `paseo.json` — keep ours (not upstream).
4. Changes to `package.json` (pnpm config, scripts, dep reorg) — merge carefully.
5. Changes to `chatCore.js`, `stream.js`, `claudeCloaking.js` — may conflict with our timeout/decloak changes.
6. Changes to `usageDb.js` — may conflict with our flush hooks.
7. Changes to `Dockerfile`, CI workflows — may conflict with pnpm changes.
8. Tests — may conflict with our fixes.
9. Everything else: prefer upstream.

## Branding decision

Per the project convention (`AGENTS.md`):
- Internal references keep "9router" (package name, data dir, env vars).
- "9router" is used only for external/repo context (README, repo name, GitHub URLs).

This is a deliberate minimal-divergence approach. Do not bulk-rename internal references to 9router. If the upstream (`decolua/9router`) adopts a different naming convention, coordinate before diverging.

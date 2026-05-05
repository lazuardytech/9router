# Fork Status

## Lineage

```
CLIProxyAPI (Go)         original — by router-for-me
        ↓
9Router (JS port)        active upstream — github.com/decolua/9router
        ↓
melma-router             this repo — github.com/lazuardytech/melma-router
        ↓
OmniRoute (TS port)      sister fork — github.com/diegosouzapw/OmniRoute
```

## Sync state (as of 2026-05-05)

melma-router `master` HEAD = upstream `decolua/9router@master` HEAD (commit `1c83142 Update Changelog`).

528 commits identical, zero file diff except local `README.md` and (after this commit) `.agents/` + `AGENTS.md`.

**Initial commit `3857598`** is a flat snapshot — NOT a `git fork` clone. History before `3857598` does not exist locally. To pull upstream history with full graph, would need to re-clone from upstream.

## Sync setup

Remote already configured:
```bash
git remote -v
# origin    git@github.com:lazuardytech/melma-router.git
# upstream  https://github.com/decolua/9router.git
```

To sync future upstream changes:
```bash
git fetch upstream
git log --oneline master..upstream/master   # check what's new
git merge upstream/master                   # merge (or rebase if preferred)
git push origin master
```

## Local divergence (what makes this melma-router not 9router)

Currently MINIMAL:
- `README.md` — replaced with internal Lazuardy Tech notice
- `.agents/`, `AGENTS.md` — this documentation

Everything else is byte-identical to upstream. **Code references still say "9router"** (package name, data dir, env vars, GitHub raw URLs in `skills.js`). See gotcha #13 in `07-gotchas.md`.

## When merging upstream

1. `README.md` will conflict — keep ours (Lazuardy Tech notice).
2. `.agents/` and `AGENTS.md` won't conflict (don't exist upstream) — keep ours.
3. Anything else: prefer upstream (we have no other intentional divergence yet).

## Branding decision pending

Not yet decided whether to:
- Rename internal references (`9router` → `melma-router`, data dir, env vars, package name, skills URL), OR
- Stay as a "skin" fork that only differs in README + agent docs

Default assumption: stay minimal-divergence until product owner says otherwise. **Ask before bulk-renaming.**

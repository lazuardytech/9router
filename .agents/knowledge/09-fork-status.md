# Fork Status

## Repository Identity

- Repo: `github.com/lazuardytech/9router`
- Branch: `master`
- Current tagged release baseline: **v0.3.1**

## Recent Release Tags in This Branch

- `v0.2.8`
- `v0.2.9`
- `v0.3.0`
- `v0.3.1`

Feature highlights across these tags:
- reasoning/thinking passthrough fixes
- semantic cache and memory layer
- per-key rate limit config + enforcement
- dashboard navigation update with Memory and Cache pages

## Current Remote Setup

At this snapshot:

```bash
git remote -v
# origin  git@github.com:lazuardytech/9router.git
```

No `upstream` remote is currently configured in local checkout.

## Divergence Notes

The branch is intentionally customized for Lazuardy/Melma needs, with emphasis on:

1. pnpm-first build and CI flow
2. Docker publish to Docker Hub `lazuardytech/9router`
3. Memory/cache/rate-limit features integrated into API and dashboard
4. Internal contributor docs (`AGENTS.md`, `.agents/*`) maintained in-repo

## Sync Guidance (if upstream re-link is needed later)

If upstream sync is required in the future:
1. add upstream remote explicitly
2. inspect diff by feature area (API routes, `open-sse`, sqlite schema, workflows)
3. preserve local release/versioning and Docker publishing conventions

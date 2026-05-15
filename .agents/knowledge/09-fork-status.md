# Fork Status

## Repository Identity

- Repo: `github.com/lazuardytech/pod`
- Branch: `main`
- Current tagged release baseline: **v0.0.1**

## Recent Release Tags in This Branch

- `v0.0.1` — full rebranding from 9router to Pod, bun migration, route restructure

Feature highlights:
- App renamed to Pod (`lazuardytech/pod`)
- Migrated from pnpm to bun (v1.3.14)
- All dashboard routes dropped `/dashboard` prefix
- `/health` page with TelemetryCard sparklines, DB/Provider/Rate Limit status
- `/logs` page consolidating Request Logs, Proxy Logs, Console Logs
- API Keys table on endpoint page (pagination, edit/remove)
- Sidebar collapse (icon-only mode)
- Light/dark/system theme switcher
- Settings page rewritten with Linear design system
- Data dir: `~/.pod/`, SQLite file: `pod.sqlite`
- Docker: builder `node:22-alpine`, runner `oven/bun:1.3.14-alpine`

## Current Remote Setup

```bash
git remote -v
# origin  git@github.com:lazuardytech/pod.git
```

No `upstream` remote is currently configured in local checkout.

## Divergence Notes

The branch is intentionally customized for Lazuardy/Melma needs, with emphasis on:

1. bun-first build and CI flow
2. Docker publish to Docker Hub `lazuardytech/pod`
3. Memory/cache/rate-limit features integrated into API and dashboard
4. Internal contributor docs (`AGENTS.md`, `.agents/*`) maintained in-repo
5. Version reset to v0.0.1 as new identity baseline

## Sync Guidance (if upstream re-link is needed later)

If upstream sync is required in the future:
1. Add upstream remote explicitly
2. Inspect diff by feature area (API routes, `open-sse`, sqlite schema, workflows)
3. Preserve local release/versioning and Docker publishing conventions

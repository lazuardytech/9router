# Fork Status

## Repository Identity

- Repo: `github.com/lazuardytech/pod`
- Branch: `main`
- Current tagged release: **v0.0.5**

## Release History

| Tag | Highlights |
|---|---|
| `v0.0.1` | Full rebranding from 9router → Pod, bun migration, route restructure, Linear design system |
| `v0.0.2` | Sonner toasts, request log dedup, status rename SUCCESS, toolbar lifting pattern |
| `v0.0.3` | Full bun runtime (oven/bun:1.3.14-alpine), bun:sqlite production, Tailscale fix, Codex OAuth fix |
| `v0.0.4` | Quota grouped table, usage chart 90d, ConfirmModal everywhere, MITM removed, details_id linking |
| `v0.0.5` | Console logs Live/Refresh, quota no-flicker, SegmentedControl standardized, Button/Badge standardized, system info from API |

## Current Remote Setup

```bash
git remote -v
# origin  git@github.com:lazuardytech/pod.git
```

No `upstream` remote configured.

## Divergence Notes

Branch is intentionally customized for Lazuardy Tech needs:

1. bun-first build and CI flow
2. Docker publish to Docker Hub `lazuardytech/pod`
3. Memory/cache/rate-limit features integrated into API and dashboard
4. Linear design system (dark/light theme)
5. Internal contributor docs (`AGENTS.md`, `.agents/*`) maintained in-repo
6. Version reset to v0.0.1 as new identity baseline

## Docker Hub

- Image: `lazuardytech/pod`
- Tags: `v0.0.1`, `v0.0.2`, `v0.0.3`, `v0.0.4`, `v0.0.5`, `latest`
- Platform: `linux/amd64`

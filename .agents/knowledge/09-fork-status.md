# Fork Status

## Repository Identity

- Repo: `github.com/lazuardytech/pod`
- Branch: `main`
- Current tagged release: **v0.0.14**

## Release History

| Tag | Highlights |
|---|---|
| `v0.0.1` | Rebranding 9router → Pod, bun migration, route restructure, Linear design system |
| `v0.0.2` | Sonner toasts, request log dedup, status rename SUCCESS, toolbar lifting |
| `v0.0.3` | Full bun runtime (`oven/bun:1.3.14-alpine`), `bun:sqlite` production, Tailscale fix, Codex OAuth fix |
| `v0.0.4` | Quota grouped table, usage chart 90d, ConfirmModal everywhere, MITM removed, `details_id` linking |
| `v0.0.5` | Console logs Live/Refresh, quota no-flicker, SegmentedControl standardized, system info from API |
| `v0.0.6` | Request/Proxy Logs SSE stream, model listing auth, `headerActionStore`, Blackbox + MiniMax, semantic cache `stream=undefined` fix, upstream fixes (role normalization, stall timeout, Ollama usage, Gemini schema, DATA_DIR fallback) |
| `v0.0.7–v0.0.11` | Streaming cache fix, provider node rename, model lock tests, cache/memory tests, log cap 10K, logs UX, button color fix (`text-primary-fg`) |
| `v0.0.12` | `renameProviderNode` atomic cascade, `PATCH /api/provider-nodes/[id]/rename`, `bun run check` script, 433 total tests |
| `v0.0.13` | Memory leak fixes (1.2GB → ~200–400MB): SSE abort cleanup, LRUCache for memory store, SQLite pragma reduction, `bun --smol`, cache temperature threshold `> 1` |
| `v0.0.14` | ESLint fix (`react/no-unescaped-entities`), `paseo.json` gitignored, `melma-router` binary removed |
| `v0.0.14+` | Removed `--smol` from Dockerfile CMD; added cache memory env vars (`SEMANTIC_CACHE_MAX_BYTES`, `SEMANTIC_CACHE_MAX_SIZE`, `PROMPT_CACHE_MAX_BYTES`, `PROMPT_CACHE_MAX_SIZE`) |

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
- Tags: `v0.0.1`–`v0.0.14`, `latest`
- Platform: `linux/amd64`

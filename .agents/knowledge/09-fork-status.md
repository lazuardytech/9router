# Fork Status

## Repository Identity

- Repo: `github.com/lazuardytech/pod`
- Branch: `main`
- Current tagged release: **v0.0.31**

## Release History

| Tag | Highlights |
|---|---|
| `v0.0.1` | Rebranding 9router → Pod, bun migration, route restructure, Linear design system |
| `v0.0.2` | Sonner toasts, request log dedup, status rename SUCCESS, toolbar lifting |
| `v0.0.3` | Full bun runtime (`oven/bun:1.3.14-alpine`), `bun:sqlite` production, Tailscale fix, Codex OAuth fix |
| `v0.0.4` | Quota grouped table, usage chart 90d, ConfirmModal everywhere, MITM removed, `details_id` linking |
| `v0.0.5` | Console logs Live/Refresh, quota no-flicker, SegmentedControl standardized, system info from API |
| `v0.0.6` | Request/Proxy Logs SSE stream, model listing auth, `headerActionStore`, Blackbox + MiniMax, semantic cache `stream=undefined` fix, upstream fixes |
| `v0.0.7–v0.0.11` | Streaming cache fix, provider node rename, model lock tests, cache/memory tests, log cap 10K, logs UX, button color fix (`text-primary-fg`) |
| `v0.0.12` | `renameProviderNode` atomic cascade, `PATCH /api/provider-nodes/[id]/rename`, `bun run check` script, 433 total tests |
| `v0.0.13` | Memory leak fixes (1.2GB → ~200–400MB): SSE abort cleanup, LRUCache for memory store, SQLite pragma reduction, `bun --smol`, cache temperature threshold `> 1` |
| `v0.0.14` | ESLint fix, `paseo.json` gitignored, `melma-router` binary removed |
| `v0.0.15` | Remove `--smol`, add cache memory env vars, CONTRIBUTING.md, SECURITY.md, README improvements |
| `v0.0.16` | (skipped) |
| `v0.0.17` | Drag-to-reorder combos + provider connections (`@dnd-kit`), multi-account custom providers, `sort_order` SQLite migration |
| `v0.0.18` | Fix all 23 CodeQL security alerts (SSRF, insecure randomness, XSS, stack trace, workflow permissions) |
| `v0.0.19` | Biome `--unsafe` lint fixes, quota page disabled-model filter, `h-1.5` progress bars, health page improvements |
| `v0.0.20` | Semantic cache 0% hit rate fix (memory injection signature mismatch), configurable minimum lockout time, quota toolbar improvements, logs `h-[70vh]`, health page lockout clear button |
| `v0.0.21` | Minimum lockout fix: guard too aggressive (skipped longer cooldowns), `resetsAtMs` path skipped minimum; both fixed in `auth.js` |
| `v0.0.22` | Semantic cache: temperature/top_p normalization, `approxRequestBytes` content-block fix; cache hit rate now reliable |
| `v0.0.23` | Perf: `PRAGMA integrity_check` cached 5min, health stream 10s interval, request-logs stream fixed 2s poll; 23 new SSE hotpath tests |
| `v0.0.24` | API key `last_access_at` tracked on every auth request, shown in /endpoint table; Est. Cost rounds up to 2 decimal places |
| `v0.0.25` | models.dev pricing sync: `src/lib/modelsDevSync.js`, periodic sync on boot, "Sync Now" in /settings, `GET/POST /api/pricing/sync`; pricing resolution order: overrides → models.dev → static |
| `v0.0.26` | Model lock count tracking: `modelLockCount_${model}` flat field, backoff multiplier (1x/2x/3x…); Vertex AI `stream` field removed from request body; semantic cache `requestTooLargeForCache` guard removed |
| `v0.0.27` | Bug fixes: tunnel pings `tunnelUrl` not `publicUrl`; /providers "Connected Only" noAuth fix; /media-providers grid from `allProviders`; /quota disabled always hidden, toolbar state to localStorage; /usage Details observability toggle reads both fields |
| `v0.0.28` | UI: /providers detail up/down arrows removed (drag handles priority); /health Model Lockout moved below Provider Health, custom icons fixed; /combos "Test All" button; /logs Proxy Logs Actions column fixed width; /quota white active style on collapse/expiring/hide buttons; Melma removed from APIKEY_PROVIDERS |
| `v0.0.29` | Tunnel enable error sanitization + non-fatal `fetchData()`; cloud worker `testClaude.js` stub (410 deprecated); Vertex AI stream guard tests (26); console logs scroll-to-bottom on `init`; quota hide-disabled toggle fix; README env vars (`INITIAL_PASSWORD`, `BASE_URL`, `CLOUD_URL`); 533 total tests (31 files) |
| `v0.0.30` | (intermediate) |
| `v0.0.31` | Semantic cache fixes: SQLite TTL (`strftime` ISO 8601), `memoryOwnerId` in signature (cross-user cache bleed prevention), temperature `null`→`1` normalization, 512KB response limit, `clearInFlight` unconditional in all 3 response paths; memory strategy fixes (`"recent"` explicit alias for `"exact"`, `/api/memory` added to `PROTECTED_API_PATHS`); 711 total tests (37 files) |

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
- Tags: `v0.0.1`–`v0.0.31`, `latest`
- Platform: `linux/amd64`

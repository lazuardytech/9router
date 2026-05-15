# Overview

Pod is Lazuardy Tech's internal AI routing proxy.

Current baseline: **v0.0.6**.

## Core Capabilities

- OpenAI-compatible and Anthropic-compatible gateway endpoints under `/v1/*`
- Multi-provider routing with account fallback and format translation
- Streaming + non-streaming handling through `open-sse`
- Semantic response cache
- Conversational memory injection/extraction
- API key auth with optional per-key rate limit (`unlimited` / `limited`)
- Proxy pool support with Vercel relay option
- Tailscale and Cloudflare tunnel integration

## Dashboard Information Architecture

- **API**: Endpoint, Providers, Media Providers, Combos
- **Analytics**: Usage & Analytics, Quota Tracker
- **System**: Proxy Pools, Logs, Health, Settings

## Tech Stack

- Next.js + React 19
- Pure JavaScript (ESM style)
- Tailwind CSS v4
- bun v1.3.14 as package manager and runtime
- SQLite (`bun:sqlite` in production, `better-sqlite3` in tests only)
- Linear design system (dark/light theme)

## Repository Layout

| Dir | Purpose |
|---|---|
| `src/` | Next.js app UI and API routes |
| `open-sse/` | Core router/translator/executor engine |
| `cloud/` | Cloud companion code |
| `tests/` | Unit and integration tests |
| `.agents/` | Agent-oriented project knowledge |

## Features by Version

### v0.0.1
- App renamed Pod (`lazuardytech/pod`), migrated pnpm → bun
- All dashboard routes dropped `/dashboard` prefix
- `/health` page with TelemetryCard sparklines, DB/Provider/Rate Limit status
- `/logs` multi-tab: Request Logs, Proxy Logs, Console Logs
- API Keys table on `/endpoint` (pagination, edit/remove)
- Sidebar collapse (icon-only mode), light/dark/system theme
- Settings page rewritten with Linear design system
- Data dir: `~/.pod/`, SQLite: `pod.sqlite`
- Custom SVG logo, RealFaviconGenerator assets

### v0.0.2
- Sonner toasts replacing custom notification store
- Request log dedup (UPDATE PENDING row on completion)
- Status rename: "200 OK" → "SUCCESS"
- Proxy Logs silent refresh, toolbar lifted to LogsClient
- Console Logs level filter pills, auto-scroll/clear in header
- API Keys table: Last Access At column, always-visible actions
- Button variants standardized (bg-porcelain primary)
- Endpoint badges: text-sm font-mono py-0.5

### v0.0.3
- Full bun runtime: builder `oven/bun:1.3.14-alpine` + runner bun
- `bun:sqlite` in production, `better-sqlite3` devDependency only
- Tailscale fix: `getCachedPassword` removed
- Codex OAuth: `redirect_uri` uses `NEXT_PUBLIC_CLOUD_URL` or `window.location.origin`
- Tab title separator changed from `•` to `✦`
- Logs columns fixed widths, select widths standardized

### v0.0.4
- Quota page: grouped table view with 3-level expand/collapse by provider
- Usage chart: 60d→90d (quarterly), fill-width sparkline, unit of measure per period
- Health sparklines full width, integrity uppercase "OK"
- Checkbox accent color white/dark, black/light theme
- All browser `confirm()` replaced with in-app `ConfirmModal`
- Breadcrumb label text `mt-0.5 ms-0.5` alignment
- MITM bypass feature removed entirely
- Tailscale "exited with code" error → sonner toast
- Memory page crash fixed (missing confirmDialog state)
- Provider health grouped by provider (worst state wins)
- Request log detail: widen timestamp window ±5min, model-less fallback
- Console logs search input pl-8 spacing fix
- Combos page: Test button per combo

### v0.0.5
- Console logs: Refresh/Live toggle, fix "Connecting..." status
- Quota page: no spinner on refresh, dim rows while loading, skeleton on initial load
- Quota page: Collapse All button
- Settings system info: runtime and platform from server-side API
- Usage topology: logo.svg + dark:invert, edge color #E5E5E6
- Sidebar app title text-xl
- Pill tabs standardized via SegmentedControl across /usage and /logs
- Request logs: provider filter moved to toolbar, detail payload via details_id linking
- Button and Badge usage standardized across app
- Input+button height alignment (cache maintenance, endpoint copy modal)
- Endpoint badges min-w-[90px]
- Settings: removed Migrate to SQLite button

### v0.0.6
- Upstream 9router fixes: developer role normalization (developer→system), stream stall timeout 3min, Ollama usage tracking, Gemini schema `ensureObjectType`, `DATA_DIR` graceful fallback on EACCES/EPERM
- Request Logs SSE live stream: `GET /api/usage/request-logs/stream` endpoint
- Proxy Logs SSE live stream: `GET /api/proxy-pools/stream` endpoint
- Console Logs: Refresh/Live toggle (already had SSE, now surfaced in UI)
- Semantic cache fix: `isCacheableForRead/Write` treats `stream=undefined` as non-streaming
- Provider node Identifier field: optional custom ID on create, read-only on edit
- Connected Only toggle: moved to header via `headerActionStore` (providers + media-providers pages)
- `headerActionStore`: new Zustand store at `src/store/headerActionStore.js` for page-level header action buttons
- kebab-case URL redirects: `/media-providers/web-search/:id*` → `/media-providers/webSearch/:id*`, same for web-fetch
- Security: `GET /v1/models`, `/v1/models/[kind]`, `/v1beta/models` now enforce API key auth when `requireApiKey=true`; timing-safe key comparison in `validateApiKey`
- `SegmentedControl` size standardized to `sm` across all tab UIs
- Usage topology: active line color changed to green
- Usage Details: Clear Filters button uses `variant=secondary` + delete icon
- Breadcrumb: webSearch/webFetch href → `/media-providers/web`
- Blackbox provider support
- MiniMax TTS support
- "Today" period added to usage chart

## Ground Rules

- Use `bun` for all install/build/test workflows
- Validate with `bun run test:run` and `bun run build` before release/tag
- Always bump `package.json` AND `src/shared/constants/config.js` `displayVersion` together
- Never use browser `confirm()` — use `ConfirmModal`
- No MITM bypass code

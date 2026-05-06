# Code Conventions

## Language & modules

- **Pure JS, ESM only.** No `.ts/.tsx`. JSDoc only for type hints (`@type`).
- `package.json:5` has no `"type"` field but ESM works via `.mjs` configs + `jsconfig.json` `"module": "ESNext"`.
- Configs: `.mjs` (`next.config.mjs`, `postcss.config.mjs`, `eslint.config.mjs`).
- All other code: `.js`. JSX in `.js` files.
- All imports `import …` — zero `require()`.

## Naming

| Kind | Convention | Examples |
|---|---|---|
| Lib/util files | camelCase | `localDb.js`, `tunnelManager.js`, `requestDetailsDb.js` |
| React components | PascalCase | `Sidebar.js`, `OAuthModal.js`, `AddCustomEmbeddingModal.js` |
| Next.js route segments | kebab-case | `proxy-pools/`, `media-providers/`, `api/v1/chat/completions/route.js` |
| Client splits | `…Client.js` suffix | `ConsoleLogClient.js`, `BasicChatPageClient.js` |
| Functions | camelCase | `getProviderCredentials`, `formatProviderError` |
| React components | PascalCase | `<Sidebar />` |
| Constants | UPPER_SNAKE | `HTTP_STATUS`, `LOG_LEVELS`, `RESTART_COOLDOWN_MS` |
| Zustand hooks | `useXStore` (default export) | `useThemeStore` |

## Path aliases (`jsconfig.json`)

```jsonc
{
  "@/*":         "./src/*",       // primary src alias
  "open-sse":    "./open-sse",    // bare specifier (NOT npm dep)
  "open-sse/*":  "./open-sse/*"   // sub-imports
}
```

Use `@/lib/localDb`, `@/sse/handlers/chat.js`, `open-sse/handlers/chatCore.js`, etc.

## Error handling

**No custom Error classes anywhere.** Pattern: `throw new Error("msg")` at boundaries; plain object results in proxy hot path.

OpenAI-compat JSON envelope, centralized in `open-sse/utils/error.js`:

| Helper | Purpose |
|---|---|
| `buildErrorBody(status, msg)` | `{ error: { message, type, code } }` |
| `errorResponse(status, msg)` | `Response` with CORS |
| `parseUpstreamError(response, executor?)` | Per-provider executor `parseError()` extracts `resetsAtMs` |
| `createErrorResult(status, msg, resetsAtMs)` | `{ success:false, status, error, response, resetsAtMs }` — chatCore handler return shape |
| `unavailableResponse(status, msg, retryAfter, retryAfterHuman)` | Adds `Retry-After` header |
| `formatProviderError(err, provider, model, status)` | `[CODE]: msg (cause: UND_ERR_SOCKET: ...)` — exposes `error.cause.code` for undici fetch failures |

Used at `open-sse/handlers/chatCore.js:187`, `embeddingsCore.js:59`, `imageGenerationCore.js:61`. Routes return `errorResponse(...)` — never `NextResponse.json` for `/v1/*`.

## Logging

**No real logger.** Two patterns:

1. **`console.log`/`console.error`** — 387+ matches. Convention: `[Tag]` prefix.
   ```js
   console.log("[InitApp] Tunnel was enabled, auto-resuming...");
   ```
   `console.log` is also used for handled errors (not just `console.error`).

2. **`src/sse/utils/logger.js`** — thin wrapper exporting `debug/info/warn/error/request/response/stream/maskKey`. Hardcoded `LEVEL = LOG_LEVELS.DEBUG`. Imported as `import * as log from "../utils/logger.js"`. Uses emojis (🔍 ℹ️ ❌ 📥 📤 🌊) and ANSI colors.

   ⚠️ **`log.warn()` body is commented-out (logger.js:43) — produces no output.** Use `log.error` or `console.warn` directly.

3. Server-side console capture: `initConsoleLogCapture()` invoked at module load in `src/app/layout.js:6,10`, feeds `/dashboard/console-log`.

## Async patterns

- **`async/await` exclusively.** No callbacks.
- Promise chains only for fire-and-forget background tasks: `safeRestartTunnel("startup").catch(...)`.
- **Web Streams API** for SSE: `Response`, `TextEncoder`, `WritableStreamDefaultWriter`. Write via `writer.write(encoder.encode("data: ...\n\n"))`.
- Stream helpers in `open-sse/utils/stream.js` (transform/passthrough w/ logger) and `open-sse/utils/streamHandler.js` (`createStreamController`, `pipeWithDisconnect`, `createDisconnectAwareStream`).

## Zustand

- All stores in `src/store/`, default-exported `useXStore`, aggregated in `src/store/index.js`.
- Files start with `"use client"`.
- Pattern: `(set, get) => ({ state…, setX, fetchX })` — state + setters + a `fetchX` async action calling `/api/...` and updating in place.
- Records use `_id` (Mongo-style) as identifier — backing store is lowdb/sqlite locally, NOT Mongo.
- Persistence via `zustand/middleware` `persist` only where needed (e.g. `themeStore`).
- Inconsistency: `notificationStore` exported as **named** `useNotificationStore` (not default).

## Styling

- **Tailwind v4** with PostCSS plugin `@tailwindcss/postcss`. **No `tailwind.config.js`** — config is in CSS via `@import "tailwindcss"; @custom-variant dark (&:where(.dark, .dark *));` in `src/app/globals.css:2-4`.
- Brand palette as CSS vars in `:root` (`globals.css:10-50`). Brand orange `#E56A4A`.
- No CSS modules.
- Class merging via `src/shared/utils/cn.js`.
- Component libs: `@monaco-editor/react`, `@xyflow/react` (combo flow graphs), `recharts` (UsageStats), Material Symbols font (loaded inline in `layout.js:36-38`).
- Dark mode: `.dark` class on `<html>` (`themeStore.js:46-49`), `matchMedia` for system theme detection.

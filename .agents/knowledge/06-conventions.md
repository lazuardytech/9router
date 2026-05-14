# Code Conventions

## Language and Module Style

- JavaScript only (`.js`), no TypeScript files.
- ESM import/export style is used across app/engine code.
- Keep existing file-level patterns; avoid introducing new architecture styles per feature.

## Naming and Structure

- Components: `PascalCase.js`
- Utility/lib modules: `camelCase.js`
- Next route segments: kebab-case folders
- Client-heavy route modules: `*Client.js` naming is preferred in dashboard pages

## Aliases

From `jsconfig.json`:
- `@/*` -> `src/*`
- `open-sse/*` -> local `open-sse/*`

Do not convert `open-sse` imports into package dependencies.

## Storage Access

- Use `src/lib/localDb.js` for business persistence operations.
- Use `src/lib/sqlite/connection.js` for DB-level utilities.
- Do not bypass existing facades unless the task explicitly needs schema/SQL work.

## Error Handling

- Keep compatibility error shape for public `/v1/*` endpoints.
- Use existing helpers in `open-sse/utils/error.js` when touching core handlers.
- Preserve `Retry-After` behavior on rate-limit/unavailable responses.

## Logging

- Keep existing `console.*` + `log.*` style by surrounding file/module.
- Known caveat: `log.warn()` is intentionally non-operative in current logger; prefer `log.error` or `console.warn`.

## UI Conventions

- Sidebar taxonomy must stay aligned with:
  - API: Endpoint, LLM Providers, Media Providers, Combos, Memory, Cache
  - Analytics: Usage, Quota
  - System: Proxy Pools, Console Log, Settings
- Reuse shared UI components under `src/shared/components`.

## Quality Baseline

- Minimum verification for feature-level changes:
  - `pnpm run test:run`
  - `pnpm run build`

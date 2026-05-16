# Code Conventions

## Language and Module Style

- JavaScript only (`.js`), no TypeScript.
- ESM import/export style across app/engine code.
- Keep existing file-level patterns; avoid introducing new architecture styles per feature.

## Naming and Structure

- Components: `PascalCase.js`
- Utility/lib modules: `camelCase.js`
- Next route segments: kebab-case folders
- Client-heavy route modules: `*Client.js` naming preferred in dashboard pages

## Aliases

From `jsconfig.json`:
- `@/*` → `src/*`
- `open-sse/*` → local `open-sse/*`

Do not convert `open-sse` imports into package dependencies.

## Storage Access

- Use `src/lib/localDb.js` for business persistence operations.
- Use `src/lib/sqlite/connection.js` for DB-level utilities.
- Do not bypass existing facades unless the task explicitly needs schema/SQL work.

## Error Handling

- Keep compatibility error shape for public `/v1/*` endpoints.
- Use existing helpers in `open-sse/utils/error.js` when touching core handlers.
- Preserve `Retry-After` behavior on rate-limit/unavailable responses.

## UI Conventions

### Design System
- Linear design system with dark/light theme support
- CSS variables for all color tokens (see `globals.css`)
- `html.dark` class-based dark mode; `@custom-variant dark (&:where(.dark, .dark *))` in globals.css
- Light theme overrides in `html:not(.dark)` block
- **Never use `text-white` or `text-black` with `bg-primary`**. The `--color-primary` token is near-black in light theme and near-white in dark theme. Always use `text-primary-fg` as the paired foreground — it is `#ffffff` in light and `#08090a` in dark, guaranteed readable in both.

### Components
- **Button**: use `<Button>` from `@/shared/components` — variants: `primary`, `secondary`, `outline`, `ghost`, `danger`, `success`; sizes: `sm`, `md`, `lg`
- **Badge**: use `<Badge>` from `@/shared/components` — variants: `default`, `primary`, `success`, `warning`, `error`, `info`, `violet`; sizes: `sm`, `md`, `lg`
- **Tabs**: use `<SegmentedControl>` from `@/shared/components/SegmentedControl` — standardized across all tab UIs
- **Confirm dialogs**: always use `<ConfirmModal>` from `@/shared/components/Modal` — never `window.confirm()`
- **Toasts**: use `toast` from `sonner` directly — never custom notification store
- **Input + Button side by side**: use `items-end` wrapper, `size="lg"` on Button to match Input height
- **Provider modal field order**: Add/Edit Compatible modals use Name → Identifier → Prefix → (other fields). Do not reorder.
- **Refresh buttons in `/logs`**: use `size-7` (28×28px square, icon-only). Show `animate-spin` + `disabled` while refreshing; re-enable on completion.

### Layout
- Sidebar taxonomy must stay aligned:
  - API: Endpoint, Providers, Media Providers, Combos
  - Analytics: Usage & Analytics, Quota Tracker
  - System: Proxy Pools, Logs, Health, Settings
- Sidebar supports collapse to icon-only mode — do not break this behavior
- All routes are top-level — no `/dashboard` prefix
- Tab title separator: `✦` (e.g. "Pod ✦ Health")
- Media provider sub-routes use camelCase segments: `/media-providers/webSearch`, `/media-providers/webFetch` (not kebab-case). Kebab-case variants redirect to camelCase.

### Header Action Slot
- Page-level action buttons (e.g. "Connected Only" toggle) are registered via `src/store/headerActionStore.js`.
- In the page component, call the store's register function (typically in a `useEffect`) to mount the button into the Header's action slot.
- Do not render page-specific action buttons inline inside the Header component itself.
- Clean up registration on unmount.

### Logo
- `public/logo.svg` — SVG fill `#000`, always use `dark:invert` for dark theme compatibility

## Quality Baseline

Minimum verification for feature-level changes:
```bash
bun run format
bun x eslint .
bun run test:run
bun run build
```

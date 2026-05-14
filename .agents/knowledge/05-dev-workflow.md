# Development Workflow

## Package Manager

Use **pnpm only**.

```bash
pnpm install
pnpm install --frozen-lockfile
```

Repo config:
- `.npmrc` includes `node-linker=hoisted`
- `packageManager` pinned in `package.json`

## Run / Build

```bash
pnpm run dev        # next dev --webpack --port 20128
pnpm run build      # production build
pnpm run start      # production start (PORT env or default)
pnpm run dev:bun
pnpm run build:bun
pnpm run start:bun
```

## Validation Commands

```bash
pnpm run test:run
pnpm run build
```

Optional lint:

```bash
pnpm exec eslint .
```

## Docker (Local)

Convenience script:

```bash
./start.sh
```

Main Dockerfile facts:
- Multi-stage Node 22 Alpine build
- Uses pnpm via Corepack
- Runtime port `20128`
- Data dir defaults to `/app/data` in container

## CI/CD Workflows

### Build & Test
File: `.github/workflows/ci.yml`

- Trigger: push/pull_request to `master`, and manual dispatch
- Steps:
  - install pnpm + Node 24
  - `pnpm install --frozen-lockfile`
  - `pnpm exec eslint . || true`
  - `pnpm run test:run`
  - `pnpm run build`

### Build & Push Docker Image
File: `.github/workflows/docker-publish.yml`

- Trigger: tag push `v*`, and manual dispatch
- Image: `docker.io/lazuardytech/pod`
- Platforms: `linux/amd64`
- Tag strategy includes semver tag and `latest`

## Release Flow

1. Implement + validate (`test:run`, `build`)
2. Bump version in:
   - `package.json`
   - `src/shared/constants/config.js` (`displayVersion`)
3. Commit, tag `vX.Y.Z`, push branch + tag
4. Docker workflow publishes image from tag

## Storage / Migration Notes

- SQLite file: `$DATA_DIR/pod.sqlite`
- First boot auto-runs JSON to SQLite migration when needed
- Manual migration endpoint: `/api/settings/migrate-sqlite`

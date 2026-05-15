# Development Workflow

## Package Manager

Use **bun only** (v1.3.14).

```bash
bun install
bun install --frozen-lockfile
```

Repo config:
- `bun.lock` is the lockfile (replaces `pnpm-lock.yaml`)
- `packageManager` pinned in `package.json`

## Run / Build

```bash
bun run dev        # next dev --webpack --port 20128
bun run build      # production build
bun run start      # bun /app/server.js (Next.js standalone)
```

## Validation Commands

```bash
bun run test:run   # vitest
bun run build
```

Optional format:

```bash
bun run format     # biome format --write .
```

## Docker (Local)

Convenience script:

```bash
./start.sh
```

Main Dockerfile facts:
- Multi-stage build:
  - Builder: `node:22-alpine` (for native module compilation)
  - Runner: `oven/bun:1.3.14-alpine`
- CMD: `bun /app/server.js`
- Runtime port `20128`
- Data dir defaults to `/app/data` in container

## CI/CD Workflows

### Build & Test
File: `.github/workflows/ci.yml`

- Trigger: push/pull_request to `main`, and manual dispatch
- Steps:
  - install bun 1.3.14
  - `bun install --frozen-lockfile`
  - `bun x eslint . || true`
  - `bun run test:run`
  - `bun run build`

### Format
File: `.rwx/format.yml`

- Runs `bun run format` via rwx

### Build (rwx)
File: `.rwx/build.yml`

- Runs `bun run build` via rwx

### Test (rwx)
File: `.rwx/test.yml`

- Runs `bun run test:run` via rwx

### Build & Push Docker Image
File: `.github/workflows/docker-publish.yml`

- Trigger: tag push `v*`, and manual dispatch
- Image: `docker.io/lazuardytech/pod`
- Platforms: `linux/amd64`
- Tag strategy includes semver tag and `latest`

## Release Flow

1. Implement + validate (`bun run test:run`, `bun run build`)
2. Bump version in:
   - `package.json`
   - `src/shared/constants/config.js` (`displayVersion`)
3. Commit, tag `vX.Y.Z`, push branch + tag
4. Docker workflow publishes image from tag

## Storage / Migration Notes

- SQLite file: `~/.pod/pod.sqlite`
- First boot auto-runs JSON to SQLite migration when needed
- Manual migration endpoint: `/api/settings/migrate-sqlite`

# Dev Workflow

## Package Manager

Use **bun only** (v1.3.14).

```bash
bun install
bun install --frozen-lockfile
```

Repo config:
- `bun.lock` is the lockfile
- `packageManager` pinned in `package.json`

## Run / Build

```bash
bun run dev        # next dev --webpack --port 20128
bun run build      # production build
bun run start      # bun /app/server.js (Next.js standalone)
```

## Validation Commands

```bash
bun run format     # biome format --write .
bun x eslint .     # lint
bun run test:run   # vitest
bun run build      # next build
```

Always run in this order before release: format → lint → test → build.

## Docker (Local)

```bash
./start.sh
```

Dockerfile facts:
- Multi-stage build:
  - Builder: `oven/bun:1.3.14-alpine` + `--ignore-scripts` (skips native compile)
  - Runner: `oven/bun:1.3.14-alpine`
- CMD: `bun /app/server.js`
- Runtime port: `20128`
- Data dir defaults to `/app/data` in container

## CI/CD Workflows

### Build & Test
File: `.github/workflows/ci.yml`
- Trigger: push/PR to `main`, manual dispatch
- Steps: bun install → eslint → test → build

### Format
File: `.rwx/format.yml` — runs `bun run format` via rwx

### Build (rwx)
File: `.rwx/build.yml` — runs `bun run build` via rwx

### Test (rwx)
File: `.rwx/test.yml` — runs `bun run test:run` via rwx

### Build & Push Docker Image
File: `.github/workflows/docker-publish.yml`
- Trigger: tag push `v*`, manual dispatch
- Image: `docker.io/lazuardytech/pod`
- Platforms: `linux/amd64`
- Tags: semver + `latest`

## Release Flow

1. Implement + validate (`bun run format`, `bun x eslint .`, `bun run test:run`, `bun run build`)
2. Run rwx build: `rwx run .rwx/build.yml` — wait for success
3. Bump version in **both**:
   - `package.json` → `"version"`
   - `src/shared/constants/config.js` → `displayVersion`
4. Commit, tag `vX.Y.Z`, push branch + tag
5. Docker workflow publishes image from tag

## Storage Notes

- SQLite file: `~/.pod/pod.sqlite`
- Schema migrations run automatically at boot via `src/lib/sqlite/connection.js`
- `better-sqlite3` is devDependency only (tests run under Node/vitest)
- Production uses `bun:sqlite`

# Docker

This project ships with a `Dockerfile` for building and running Pod in a container.

## Build image

```bash
docker build -t pod .
```

## Start container

```bash
docker run --rm \
  -p 20128:20128 \
  -v "$HOME/.pod:/app/data" \
  -e DATA_DIR=/app/data \
  --name pod \
  pod
```

The app listens on port `20128` in the container.

## What the volume does

```bash
-v "$HOME/.pod:/app/data" \
-e DATA_DIR=/app/data
```

`pod` stores its database at `path.join(DATA_DIR, "pod.sqlite")`.
Without `DATA_DIR`, the app falls back to the current user's home directory (for example `~/.pod/pod.sqlite` on macOS/Linux). In the container, set `DATA_DIR=/app/data` so the bind mount is actually used.

With the example above, the database file is:

```text
/app/data/pod.sqlite
```

and it is persisted on the host at:

```text
$HOME/.pod/pod.sqlite
```

## Stop container

```bash
docker stop pod
```

## Run in background

```bash
docker run -d \
  -p 20128:20128 \
  -v "$HOME/.pod:/app/data" \
  -e DATA_DIR=/app/data \
  --name pod \
  pod
```

## View logs

```bash
docker logs -f pod
```

## Optional environment variables

You can override runtime env vars with `-e`.

Example:

```bash
docker run --rm \
  -p 20128:20128 \
  -v "$HOME/.pod:/app/data" \
  -e DATA_DIR=/app/data \
  -e PORT=20128 \
  -e HOSTNAME=0.0.0.0 \
  -e DEBUG=true \
  --name pod \
  pod
```

## Rebuild after code changes

```bash
docker build -t pod .
```

Then restart the container.

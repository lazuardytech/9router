# syntax=docker/dockerfile:1.7
ARG BUN_IMAGE=oven/bun:1.3.14-alpine
ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS base
WORKDIR /app

FROM base AS builder

RUN apk --no-cache upgrade && apk --no-cache add python3 make g++ linux-headers

COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
  npm install -g bun@1.3.14 && \
  bun install --frozen-lockfile

COPY . ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM oven/bun:1.3.14-alpine AS runner
WORKDIR /app

LABEL org.opencontainers.image.title="pod"

ENV NODE_ENV=production
ENV PORT=20128
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/app/data

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/open-sse ./open-sse
COPY --from=builder /app/src/shared ./src/shared

# Install tailscale (userspace mode, no systemd needed)
# Alpine edge/community has tailscale package
RUN apk --no-cache upgrade && apk --no-cache add su-exec curl && \
  apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community tailscale || \
  (ARCH=$(uname -m) && \
   case "$ARCH" in \
     x86_64) TS_ARCH=amd64 ;; \
     aarch64) TS_ARCH=arm64 ;; \
     armv7l) TS_ARCH=arm ;; \
     *) TS_ARCH=amd64 ;; \
   esac && \
   TS_VERSION=$(curl -fsSL "https://pkgs.tailscale.com/stable/?mode=json" | grep -oP '"version":"\K[^"]+' | head -1) && \
   echo "Installing tailscale ${TS_VERSION} for ${TS_ARCH}" && \
   curl -fsSL "https://pkgs.tailscale.com/stable/tailscale_${TS_VERSION}_${TS_ARCH}.tgz" -o /tmp/ts.tgz && \
   tar -xz --strip-components=1 -C /usr/local/bin -f /tmp/ts.tgz && \
   rm /tmp/ts.tgz) && \
  which tailscale && tailscale version

RUN mkdir -p /app/data && chown -R bun:bun /app && \
  mkdir -p /app/data-home && chown bun:bun /app/data-home && \
  ln -sf /app/data-home /root/.9router 2>/dev/null || true

# Fix permissions at runtime (handles mounted volumes)
RUN printf '#!/bin/sh\nchown -R bun:bun /app/data /app/data-home 2>/dev/null\n# Start tailscaled in userspace mode (background)\nmkdir -p /app/data/tailscale\ntailscaled --tun=userspace-networking --socket=/app/data/tailscale/tailscaled.sock --state=/app/data/tailscale/state &\nexec su-exec bun "$@"\n' > /entrypoint.sh && \
  chmod +x /entrypoint.sh

EXPOSE 20128

ENTRYPOINT ["/entrypoint.sh"]
CMD ["bun", "run", "start"]

# Build from the repository root: docker build -f apps/api/Dockerfile .
# turbo prune keeps only what the API needs, with the shared lockfile trimmed to match.
FROM node:22-alpine AS base
RUN corepack enable && npm install -g turbo@2.11.7
WORKDIR /repo

FROM base AS prune
COPY . .
RUN turbo prune api --docker

FROM base
COPY --from=prune /repo/out/json/ .
# The API runs its TypeScript through tsx (a dev dependency), so install everything, as `pnpm start` needs.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ .
WORKDIR /repo/apps/api
ENV NODE_ENV=production \
    PORT=5000
EXPOSE 5000
# Runs as the image's unprivileged `node` user: the API only reads its files and writes to /tmp (tsx's cache).
USER node
# Liveness: the process answers. Not /health, which also checks the database: a database blip must not get the
# container replaced, which would drop every socket and help nothing. Point monitoring at /health instead.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/" || exit 1
# Node itself is PID 1 (`pnpm start` put pnpm and cross-env in between, so SIGTERM never reached the API), and the
# API handles SIGTERM: it finishes in-flight requests and pushes, then exits 0 (src/lib/shutdown.ts).
# Listens on every interface unless LISTEN_HOST is set. Configuration comes from the environment.
CMD ["node", "--import", "tsx", "src/index.ts"]

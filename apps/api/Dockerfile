# Build from the repository root: docker build -f apps/api/Dockerfile .
# turbo prune keeps only what the API needs, with the shared lockfile trimmed to match.
FROM node:22-alpine AS base
# Pull in Alpine security fixes (zlib, openssl) published after the node image was built.
RUN apk upgrade --no-cache
RUN corepack enable && npm install -g turbo@2.11.7
WORKDIR /repo

FROM base AS prune
COPY . .
RUN turbo prune api --docker

FROM base
COPY --from=prune /repo/out/json/ .
# The API runs its TypeScript through tsx, which is a regular dependency, so a production install is enough. Lint,
# type and migration tooling (eslint, drizzle-kit, old esbuild copies) stays out of the image.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile --prod
COPY --from=prune /repo/out/full/ .
# The install is done: drop npm, corepack, pnpm and turbo. The API runs on `node` + tsx alone, and these tools only
# add copies of brace-expansion, glob, minimatch, ip-address, tar, etc. that scanners flag.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/turbo /root/.cache /root/.local /root/.npm
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

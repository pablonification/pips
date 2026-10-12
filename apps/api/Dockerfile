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
ENV PORT=5000
EXPOSE 5000
# Listens on every interface unless LISTEN_HOST is set. Configuration comes from the environment.
CMD ["pnpm", "start"]

# Build from the repository root: docker build -f apps/web/Dockerfile .
# turbo prune keeps only what the web app needs, with the shared lockfile trimmed to match.
FROM node:22-alpine AS base
RUN corepack enable && npm install -g turbo@2.11.7
WORKDIR /repo

FROM base AS prune
COPY . .
RUN turbo prune web --docker

FROM base AS build
COPY --from=prune /repo/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ .
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_VAPID_KEY
# The API's R2_PUBLIC_URL: only files there become links in Data SPARTA Magang. Optional.
ARG VITE_MEDIA_URL
ENV VITE_API_URL=$VITE_API_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_VAPID_KEY=$VITE_VAPID_KEY \
    VITE_MEDIA_URL=$VITE_MEDIA_URL
RUN turbo run build --filter=web

FROM caddy:2-alpine
COPY --from=build /repo/apps/web/dist /srv
RUN printf ':3000 {\n  root * /srv\n  try_files {path} /index.html\n  file_server\n}' > /etc/caddy/Caddyfile
EXPOSE 3000

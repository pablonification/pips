# 5. The API runs its TypeScript directly, in a container

Status: accepted.

## Context
Most servers are compiled from TypeScript to JavaScript before they run. This one is not, and a newcomer opening
the Dockerfile may think that is a mistake.

## Decision
- The API has no build step. The image (`apps/api/Dockerfile`) installs every dependency, including the
  development ones, and starts `node --import tsx src/index.ts`. `tsx` is a tool that runs TypeScript files as they
  are.
- The web app is built to static files and served by Caddy (`apps/web/Dockerfile`, `apps/web/Caddyfile`).
- Both images run as an unprivileged user, and CI builds and starts both of them (the `docker` job in
  `.github/workflows/check.yml`). The API's check includes starting it without a database and making sure it
  stays up.
- Node itself is the container's main process, so the stop signal reaches the API and it shuts down cleanly
  (`apps/api/src/lib/shutdown.ts`).

## What else was possible
- Compile the API (`tsc` or a bundler) and ship only the JavaScript: a smaller image and a server that fails to
  start on a type error. It also means rewriting the `~/…` import paths the code uses, which is real work.

## What it costs
- The image carries development packages.
- A type error does not stop the server from starting. Only `pnpm check` in CI catches it.
- Start-up is a little slower, and `tsx` is one more tool whose update can change what runs in production.

## When to revisit
When start-up time or image size starts to matter, or when a type error reaches production.

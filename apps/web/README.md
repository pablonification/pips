# PIPS! web

The HMIF ITB members app: a React PWA built with Vite, TanStack Router and Query, and the Garis design system
(`src/styles/garis/`, `src/components/garis/`, `src/components/icons/`). It lives in the `pips` monorepo next to the
API (`apps/api`).

## Run it

From the repository root, with Node 22 or later and pnpm (`corepack enable` picks the pinned version):

```bash
pnpm install
pnpm --filter web dev
```

`.env.development` holds the public development values; put your own (API URL, Google client ID, push key) in
`.env.local`, which Git ignores.

The dev server sends `/api` to `DEV_API_ORIGIN` (default `http://127.0.0.1:5000`).

## Check it

```bash
pnpm --filter web check     # type check and lint (the Garis rules cover all of src)
pnpm --filter web test      # unit tests
pnpm --filter web build     # production build
pnpm --filter web budgets   # performance budgets on the build (strict; BUDGETS_STRICT=0 only warns)
node scripts/verify-production-bundle.mjs dist   # nothing that must not ship
pnpm --filter web e2e       # browser journeys and visual references (see e2e/README.md)
```

## The API client

`src/api/generated` is generated; never edit it by hand. `pnpm --filter web api` rebuilds it from the API in this
repository (no server or database needed); `pnpm --filter web api-staging` reads staging's.

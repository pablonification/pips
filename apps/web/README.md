# PIPS! web

The members app: a React PWA built with Vite, TanStack Router and Query, and the Garis design system. How it is laid
out is in [docs/architecture.md](../../docs/architecture.md), how to build screens with Garis is in
[docs/design-system.md](../../docs/design-system.md), and the first run, including a signed-in account, is in
[CONTRIBUTING.md](../../CONTRIBUTING.md).

## Run it

From the repository root, with the API running ([apps/api](../api/README.md)):

```bash
pnpm --filter web dev           # http://localhost:5173
```

The dev server sends `/api` to `DEV_API_ORIGIN` (default `http://127.0.0.1:5000`); set it in
`.env.development.local` if your API listens elsewhere. Put your own values (`VITE_GOOGLE_CLIENT_ID`, `VITE_VAPID_KEY`)
in `.env.local`; Git ignores it.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm --filter web check` | Type check (the app, `tests/` and `e2e/`) and lint, which includes the design-system rules. |
| `pnpm --filter web test` | Unit tests. |
| `pnpm --filter web build` | Production build. |
| `pnpm --filter web budgets` | Checks route sizes against the cap; run it after a build. |
| `pnpm --filter web api` | Regenerate `src/api/generated` from the API in this repository. |
| `pnpm --filter web exec playwright test -c e2e --project=phone-light <file>` | One journey file ([testing](../../docs/testing.md)). |

`src/api/generated` is generated: never edit it by hand. Do not run `pnpm --filter web e2e` on your machine; it runs
every journey and takes over an hour.

# PIPS! API

The server behind PIPS!: Hono with zod-described routes, PostgreSQL through Drizzle, socket.io for Curhat and Live
Counting, and web push. How it is laid out is in [docs/architecture.md](../../docs/architecture.md); the first run,
including a database and a first account, is in [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Run it

From the repository root, with a local PostgreSQL and `apps/api/.env` made from `.env.example`:

```bash
pnpm --filter api db:migrate    # build the tables; prints "Migrations applied"
pnpm --filter api dev           # restarts on every change; "Server is running on port 5000"
```

With `APP_ENV=development` the API documents itself: open `http://localhost:5000/swagger` (the raw description is at
`/doc`). In any other `APP_ENV` those two pages are off.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm --filter api check` | Type check and lint. |
| `pnpm --filter api test` | Unit tests. No database or `.env` needed. |
| `pnpm --filter api test:db` | Tests against a real database; needs `TEST_DATABASE_URL` ([testing](../../docs/testing.md)). |
| `pnpm --filter api db:migrations` | Write a new migration into `drizzle/` after `src/db/schema.ts` changed. |
| `pnpm --filter api db:migrate` | Apply the migrations to `DATABASE_URL`. |
| `pnpm --filter api db:seed` | Fill `DATABASE_URL` with a small made-up HMIF (`src/db/seed/sample-hmif.ts`) and the PIXEL form. Safe to run again; refuses unless `APP_ENV` is `development` or `staging`. |
| `pnpm --filter api openapi <file>` | Write the API's description to a file, with no server. The web app's client is built from it. |

Migrations only add things, and never run one against a database that is not yours
([decision 6](../../docs/adr/0006-migrations-only-add-things-and-run-before-the-new-code-goes-live.md)). In the
production image the migrate command is `node --import tsx src/db/migrate.ts` ([DEPLOY.md](../../DEPLOY.md)).

After changing a route or its types, regenerate the web client: `pnpm --filter web api`.

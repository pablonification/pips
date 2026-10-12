# PIPS!

The HMIF ITB members app, in one repository:

| Folder | What | Was |
| --- | --- | --- |
| `apps/web` | The web app and PWA: React, Vite, TanStack Router and Query, Tailwind | `hmif-itb/hmif-app-fe` |
| `apps/api` | The API: Hono with zod-openapi, Drizzle on PostgreSQL, socket.io | `hmif-itb/hmif-app-be` |

Both folders keep their full Git history from the old repositories.

## Work on it

```bash
pnpm install                    # every app
pnpm --filter web dev           # the web app on Vite
pnpm --filter api dev           # the API (needs apps/api/.env; see apps/api/.env.example)
pnpm check                      # type check and lint, every app
pnpm test                       # unit tests, every app
pnpm build                      # production builds
```

Each app still has its own README, scripts and `.env.example`. The web app and the API deploy separately.

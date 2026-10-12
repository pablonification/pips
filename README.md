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

The web dev server sends `/api`, `/socket.io`, `/swagger` and `/doc` to the API at `http://127.0.0.1:5000`. Set `DEV_API_ORIGIN` (in the environment or `apps/web/.env.development.local`) to use another address, for example `DEV_API_ORIGIN=http://127.0.0.1:5100` on a Mac, where AirPlay owns port 5000. It has no `VITE_` prefix, so it never reaches the bundle.

Each app still has its own README, scripts and `.env.example`. The web app and the API deploy separately.

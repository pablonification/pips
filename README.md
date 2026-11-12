# PIPS!

PIPS! is the members app of HMIF ITB, the Informatics students' association at Institut Teknologi Bandung.
Members read announcements, check the calendar, use services such as Testi Matkul and Info Lomba, and talk to HMIF
Welfare in Curhat Yuk!. It installs on a phone like a native app.

| Folder | What |
| --- | --- |
| `apps/web` | The web app: React, Vite, TanStack Router and Query. |
| `apps/api` | The API: Hono, PostgreSQL with Drizzle, socket.io. |

## Quick start

You need Node 22 or later and a local PostgreSQL 16. [CONTRIBUTING.md](CONTRIBUTING.md) has the full first run,
including a database and a test account.

```bash
corepack enable
pnpm install
cp apps/api/.env.example apps/api/.env      # then fix the lines marked CHANGE
pnpm --filter api db:migrate && pnpm --filter api dev
pnpm --filter web dev                       # in a second terminal: http://localhost:5173
```

Before a pull request: `pnpm check && pnpm test`.

## Read next

- [CONTRIBUTING.md](CONTRIBUTING.md): set it up, make a first change, open a pull request.
- [AGENTS.md](AGENTS.md): the rules for coding agents, and the ways to hurt yourself.
- [docs/README.md](docs/README.md): architecture, testing, the design system, decision records.
- [CONTEXT.md](CONTEXT.md): what angkatan, pengurus, Garis and journey mean.
- [DEPLOY.md](DEPLOY.md): how both apps are deployed.
- [SECURITY.md](SECURITY.md): how to report a problem privately.

## Licence

No licence: public to read, all rights reserved by HMIF ITB.

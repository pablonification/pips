# Deploying on HMIF's Dokploy server

Both apps build with their own Dockerfile from the repository root. Checked on the Dokploy server itself
(Ubuntu 22.04, Docker 29, PostgreSQL 18.6): both images build, start, and report healthy.

## Dokploy settings

| Setting | API (Backend) | Web (Frontend) |
| --- | --- | --- |
| Build type | Dockerfile | Dockerfile |
| Build path | `/` | `/` |
| Dockerfile | `apps/api/Dockerfile` | `apps/web/Dockerfile` |
| Docker context path | `.` | `.` |
| Domain port | `5000` (the API's `PORT`) | `3000` |

Dokploy reaches GitHub through the `dokploy-hmif` GitHub app, which is installed on `hmif-itb`. It can only see this
repository once it lives there (or once the app is given access to it).

## API settings

Keep today's environment. Changes:

- **Add `CLIENT_IP_HEADER=cf-connecting-ip`.** `app-api.hmif.dev` is behind Cloudflare, so the server only sees
  Cloudflare's addresses. Without this, the sign-in rate limit counts every member behind the same Cloudflare
  address together.
- `NIXPACKS_NODE_VERSION` is no longer used (the image brings Node 22). `LOGIN_BYPASS_KEY` is ignored in production
  and can go.
- Optional: `SENTRY_DSN`, `DB_STATEMENT_TIMEOUT_MS` (default 15 s). The rest is in `apps/api/.env.example`.

## Web build arguments

The same as today (`VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_VAPID_KEY`), plus `VITE_MEDIA_URL`, set to the
API's `R2_PUBLIC_URL`: only files there become links in Data SPARTA Magang.

The web image answers like the Vercel deployment: unknown paths get `index.html`, and every response is revalidated.
Today `app.hmif.dev` is served by Vercel, so its DNS has to point at the server for the Dokploy web app to take over.

## The database, before switching

The new API needs migrations 0024–0028. They only add things, so today's app keeps working on the migrated database.
Migrate first, then switch.

1. Back up:

   ```bash
   docker exec $(docker ps -q -f name=postgres-hmif) sh -c 'pg_dump -U "$POSTGRES_USER" -Fc hmif_app_db' > hmif-before-redesign.dump
   ```

2. Build the API image once and migrate with it, on Dokploy's network. Use the Backend's `DATABASE_URL`:

   ```bash
   docker build -f apps/api/Dockerfile -t pips-api .
   docker run --rm --network dokploy-network -e DATABASE_URL='…' pips-api node --import tsx src/db/migrate.ts
   ```

   It prints `Migrations applied`. Running it again is harmless. Production's migration records were partly written
   by hand and their id counter fell behind, which made `drizzle-kit migrate` fail with
   `Key (id)=(23) already exists`; this command fixes the counter first.

3. Point both Dokploy apps at this repository with the settings above, and deploy.
4. Check `https://app-api.hmif.dev/health` answers `{"status":"ok","database":"ok"}`.

**To go back:** point the apps at their old repositories and deploy. The old app runs on the migrated database. To
restore the database exactly: `pg_restore --clean` from the backup.

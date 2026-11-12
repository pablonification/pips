# Switching production to this repository

The runbook for the day HMIF's production moves from the two old repositories to this one, on HMIF's Dokploy server.
Both apps build with their own Dockerfile from the repository root; both images were built, started and reported
healthy on that server (Ubuntu 22.04, Docker 29, PostgreSQL 18).

The web app and the API switch together, in the same minute. Today's app can't work against the new API (its Curhat
socket carries no session, so its messages are refused; its photo upload lacks a field the new API requires), and the
new web app can't work against the old API (it calls routes the old API doesn't have).

## Before the day

Only a person with the right access can do these:

- **The web address.** `app.hmif.dev` is served by Vercel today; `app-api.hmif.dev` reaches Dokploy through
  Cloudflare. Decide how the web switches in the same minute as the API (see "The switch", step 4). If the DNS record
  moves on the day, lower its TTL to 60 seconds at least a day before.
- **Dokploy's access to the repository.** Dokploy reaches GitHub through the `dokploy-hmif` GitHub app, installed on
  `hmif-itb`. It sees this repository once it lives there or once the app is given access to it. While the
  repository is public, Dokploy can also clone it by its URL without the app.
- **Kalender's Google key.** Adding, changing or deleting a Kalender event needs a Google service-account key file
  (JSON), and production has none today, so those changes already fail. Whoever holds the service account adds the
  file to the Backend in Dokploy as a file mount (Advanced → Mounts → File mount), for example at
  `/etc/pips/google-calendar.json`, readable by the container's unprivileged `node` user. Then set
  `GOOGLE_CALENDAR_SECRET_PATH` to that absolute path, and `GOOGLE_CALENDAR_ID` to the calendar the service account
  may edit. Without the file the rest of the app works; Kalender's changes keep failing as they do today.
- **A person with a phone** for the checks after the switch, with today's app installed on it (to see the old app
  update itself), and a member account with `curhatadmin` on another device for Curhat.

## Dokploy settings

| Setting | API (Backend) | Web (Frontend) |
| --- | --- | --- |
| Build type | Dockerfile | Dockerfile |
| Build path | `/` | `/` |
| Dockerfile | `apps/api/Dockerfile` | `apps/web/Dockerfile` |
| Docker context path | `.` | `.` |
| Domain port | `5000` (the API's `PORT`) | `3000` |
| Replicas | **exactly 1**, always | 1 or more |

**Exactly one API instance.** Rate limits, the Curhat rooms and the every-minute reminder job live in the API
process's memory: two copies double the limits, split Curhat between them and send every reminder twice. This holds
during the switch too: stop the old API when the new one starts.

## API settings

Keep today's environment. These change:

| Setting | What to do | Why |
| --- | --- | --- |
| `JWT_SECRET`, `TOKEN_EXPIRATION` | keep exactly as they are | another secret, or another length, signs every member out or changes how long a session lasts |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_MAILTO` | keep exactly as they are | other keys silence every device that turned notifications on |
| `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `R2_*` | keep | the same database, sign-in and file store |
| `ALLOWED_ORIGINS` | keep (a JSON list that includes `https://app.hmif.dev`, as it is today) | writes and the Curhat socket from any other address are refused; a value that isn't JSON stops the API |
| `CLIENT_IP_HEADER` | **add** `cf-connecting-ip` | the API sits behind Cloudflare, so without it every member behind one Cloudflare address shares a sign-in rate limit. Safe only while the API is reachable through Cloudflare alone |
| `RENOTIFY_DIFF_HOURS` | **set to `3`, or remove it** (production's value is not 3) | the app tells a poster they can announce again after three hours; another value unlocks it at the wrong time |
| `GOOGLE_CALENDAR_SECRET_PATH`, `GOOGLE_CALENDAR_ID` | point at the mounted key file (see "Before the day") | Kalender's changes |
| `GOOGLE_ALLOWED_CLIENT_IDS` | add only if the web's `VITE_GOOGLE_CLIENT_ID` differs from `GOOGLE_CLIENT_ID` (today they are the same) | Google sign-in accepts only tokens issued to the listed ids |
| `NIXPACKS_NODE_VERSION`, `LOGIN_BYPASS_KEY`, `GOOGLE_CALENDAR_API_KEY` | can go | unused (the image brings Node 22; the bypass sign-in never exists in production) |
| `SMTP_*` | can go once `apps/api/src/configs/env.schema.ts` no longer lists them; until then keep them | nothing sends mail, but while the schema requires them the API won't start without them |
| `APP_ENV` | leave unset | unset means production; `staging` or `development` allow the test sign-in routes |
| `SENTRY_DSN`, `DB_STATEMENT_TIMEOUT_MS` | optional | error monitoring; a stuck database statement is cancelled after 15 s by default |

The full list is `apps/api/.env.example`.

## Web build arguments

Set these as build arguments (Dokploy's build-time arguments), since the app is built into the image:

| Argument | Value | Why |
| --- | --- | --- |
| `VITE_API_URL` | `https://app-api.hmif.dev` | the API |
| `VITE_GOOGLE_CLIENT_ID` | today's value | Google sign-in |
| `VITE_VAPID_KEY` | the API's `VAPID_PUBLIC_KEY` | notifications |
| `VITE_MEDIA_URL` | the API's `R2_PUBLIC_URL` | **the image build stops without it**: only files there become links in Data SPARTA Magang, and the content policy names it |
| `VITE_SENTRY_DSN` | optional | error monitoring |

The Frontend's `NEXT_PUBLIC_API_URL` is unused and can go.

The web image's server (`apps/web/Caddyfile`) gives the app's own paths `index.html`, answers a missing file with 404,
compresses and revalidates every response, and sends `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY` and a
`Content-Security-Policy-Report-Only` built from the arguments above.

## The switch

1. **Back up.**

   ```bash
   docker exec $(docker ps -q -f name=postgres-hmif) sh -c 'pg_dump -U "$POSTGRES_USER" -Fc hmif_app_db' > hmif-before-redesign.dump
   ```

2. **Build the API image** once from a checkout of this repository on the server:

   ```bash
   docker build -f apps/api/Dockerfile -t pips-api .
   ```

3. **Migrate**, on Dokploy's network with the Backend's `DATABASE_URL`, a few minutes before step 4:

   ```bash
   docker run --rm --network dokploy-network -e DATABASE_URL='…' pips-api node --import tsx src/db/migrate.ts
   ```

   It prints `Migrations applied`; running it again changes nothing. On a copy of production it took under a second.
   It first repairs the migration records' id counter (production's fell behind, which made `drizzle-kit migrate`
   fail with `Key (id)=(23) already exists`), then:

   - 0024, 0025: SPARTA and form tables production already has (`if not exists`, no change);
   - 0026: a form's closing time (a new empty column);
   - 0027: programme windows (a new empty table);
   - 0028: a Curhat message's device id (a new empty column and a unique index), so a resent message is saved once;
   - 0029: read marks for every Curhat message that exists, so old conversations don't all show as unread. A room's
     owner has read everything in it; each Welfare member (`curhatadmin`) has read everything except a member's
     messages with no reply after them, so the rooms still waiting for an answer stay unread. Only adds rows;
   - 0030: the PIXEL form's name and NIM questions prefill (matched by the form's slug; every question keeps its
     place).

   They only add things, and today's app keeps working on the migrated database: it ignores the new columns, the
   read marks and the prefill key.

4. **Switch the web and the API in the same minute.**
   - API: point the Backend at this repository with the settings above and deploy. Its old container must stop when
     the new one starts; never let both run.
   - Web, one of:
     - deploy this repository's `apps/web` on the Vercel project that serves `app.hmif.dev` today (the same build
       arguments as environment variables) and promote it in that minute; move the DNS to Dokploy later, at leisure;
     - or deploy the Dokploy Frontend beforehand and move `app.hmif.dev`'s DNS record to it in that minute (TTL
       lowered the day before).

   Installed copies of today's app update themselves the next time they open: the browser fetches the new service
   worker, which takes over and reloads the page into the new app. Members don't have to do anything. A tab left
   open for days keeps the old app until it is reloaded.

## Right after

1. `https://app-api.hmif.dev/health` answers `{"status":"ok","database":"ok"}`.
2. On a phone:
   - open the installed old app: within a minute it reloads into the new one;
   - sign in with Google (a real account, not test login);
   - post with a photo, and see the photo;
   - a notification arrives and a tap opens the right page;
   - Curhat: send a message, see it in Welfare's inbox on the other device, answer, and see the answer arrive;
   - on Android, share a link or a picture to PIPS! from another app's share sheet;
   - Kalender, if the key file is there: add an event, change it, delete it.
3. If anything fails, go back (below) while the backup is fresh.
4. Once a real sign-in, an upload and a post with a picture leave no content policy report in the browser's console,
   enforce the policy: in `apps/web/scripts/csp.mjs` change `Content-Security-Policy-Report-Only` to
   `Content-Security-Policy`, and redeploy the web (only the Dokploy image sends it).

## Going back

Point both apps at their old repositories (or promote the previous Vercel deployment) and deploy, again in the same
minute and with one API. Today's app runs on the migrated database, and sessions survive both ways because
`JWT_SECRET` didn't change. To restore the database exactly as it was, at the cost of everything written since:
`pg_restore --clean` from the backup.

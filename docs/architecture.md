# Architecture

PIPS! is two programs in one repository. Words such as angkatan, Garis and journey are in
[CONTEXT.md](../CONTEXT.md); the reasons behind the big choices are in [decision records](adr/README.md).

- **`apps/web`** runs in the member's browser and installs on a phone like a native app (a PWA).
- **`apps/api`** is the server. It checks who you are, reads and writes the database, keeps the live chat
  connection, and sends push notifications.

They talk in three ways: ordinary requests under `/api/...`; one live connection (socket.io) for Curhat and Live
Counting; and web push, where the API asks the phone maker's push service to wake the app. There is no shared
package. When both apps need the same rule (which files may be uploaded, which role may do what), each has a copy and
a web test keeps them equal ([decision 1](adr/0001-the-web-app-and-the-api-live-in-one-repository.md)).

## The API

A request goes **route** → **controller** → **repository** and **lib**. The request is checked against the route's
description when it arrives (a bad one gets a 400). The answer is not checked on the way out
([decision 3](adr/0003-every-api-route-is-described-and-the-web-client-is-generated-from-it.md)).

| Folder (under `apps/api/src`) | What it is for | Open first |
| --- | --- | --- |
| `index.ts`, `app.ts` | `index.ts` starts the server, the socket server, the reminder job and a clean shutdown. `app.ts` builds the HTTP app without starting it: logging, allowed origins, body size, rate limits, `/health`, the routes. Tests use `app.ts` with no server. | `app.ts` |
| `configs/` | Reads settings from the environment and refuses to start on a wrong one. | `env.schema.ts` |
| `routes/` | One file per area. A route is described with zod: address, what it takes, what it answers. The API's documentation and the web client come from these. | `category.route.ts` |
| `types/` | The zod descriptions of the data. Despite the name they are checks that run, not only types. | `curhat.types.ts` |
| `controllers/` | The handlers: read the request, check permission, call repositories, answer. `api.controller.ts` lists every router; `router-factory.ts` makes a router that needs a session. | `programme-window.controller.ts` |
| `repositories/` | Every database query, as plain functions that take the database first. | `chatroom.repo.ts` |
| `lib/` | Rules with no database and no HTTP: who may delete, when a form is open, how long a push may be, the rate limiter. Most have a unit test. | `authorization.ts`, `curhat.ts` |
| `middlewares/` | Two checks before a handler: "has one of these roles", and "may fill the SPARTA form". | `role.middleware.ts` |
| `websocket/` | The live connection: reading the session from the cookie, Curhat messages, the Live Counting room. | `connection.ts`, `curhat.ts` |
| `cron/` | One job, every minute, in production only: day-before reminders for calendar events. | `calendar-cron.ts` |
| `db/` | The schema (every table), the connection, the migrate command, seed scripts. | `schema.ts`, `migrate.ts` |

Next to `src`: `drizzle/` holds the migrations (one SQL file per change, numbered), `apps/api/scripts/openapi.ts`
writes the API's description to a file with no server, and `tests/` holds the API's tests ([testing](testing.md)).

**Which controller style to copy.** A controller either imports the database directly (`category.controller.ts`) or
takes its storage as a parameter so a test can pass a fake (`programme-window.controller.ts`, with
`controllers/deps.ts`). Copy the second. It is what lets a route test run with no database
([decision 4](adr/0004-controllers-take-their-storage-as-a-parameter-so-route-tests-need-no-database.md)).

**Who may do what.** Every route has a row in `lib/route-access.ts`: anyone, any signed-in member, or named roles,
with a note for what the handler decides further. A role-only route wraps its route in `forRoles(route, roles,
deps.getUserRoles)` (`middlewares/role.middleware.ts`), which refuses with 401 before the request is validated. Checks
that depend on the row stay in the handler: the author (`lib/authorization.ts`), the room's owner (`lib/curhat.ts`),
the post's audience, the category of an event. The socket has its own check in `websocket/curhat.ts`.
`tests/route-access.test.ts` fails on a route with no row, and checks each row with requests.

## The web app

A page goes **route file** → **feature screen** → **rules** and **data**, drawn with **Garis components** and words
from **copy**.

| Folder (under `apps/web/src`) | What it is for | Open first |
| --- | --- | --- |
| `main.tsx`, `router.ts` | Start the app, register the service worker late, create the router. | `main.tsx` |
| `routes/` | One small file per address. TanStack Router reads the folder and writes `routeTree.gen.ts`. A route file names its screen and starts its data early. `_app.tsx` requires sign-in and wraps pages in the shell. | `__root.tsx`, `_app.tsx` |
| `features/<name>/` | One folder per area members know. Inside, by habit: `<Name>Screen.tsx` (the page), `rules.ts` (pure logic with a unit test), `data.ts` (requests), `<name>.css`. | `beranda/`, `kalender/` |
| `components/garis/`, `components/icons/` | The design system's parts and icons ([design system](design-system.md)). | `index.ts` |
| `components/shell/` | The frame around every page: tab bar, rail, sidebar, top bar, back, global search. It imports no feature code; features register with it at start. | `AppShell.tsx` |
| `api/` | `generated/` is the API client (never edited). `client.ts` adds a time limit. `queries.ts`, `constants.ts` hold shared requests and their keys. `persistence-policy.ts` says what stays on the device. | `client.ts`, `persistence-policy.ts` |
| `hooks/` | The few hooks more than one feature uses: `useOnline`, `useDelayed` (a skeleton only after 300 ms), `useNow`, `useUnsentText`, the session. Look here before writing one. | `useOnline.ts` |
| `lib/` | Rules with no screen: the service registry, the capability map, session, push, uploads, dates, the route table, old-address redirects. | `services.ts`, `capabilities.ts`, `shell/routes.ts` |
| `copy/` | Every sentence the app shows, one file per area, and `glossary.ts`. | `common.ts`, `glossary.ts` |
| `styles/garis/` | The design system's CSS: tokens, type, components, shell. | `tokens.css` |
| `sw.ts` | The service worker: stores the app's files so it opens offline, shows push notifications, opens the right page when one is tapped. | `sw.ts` |

**Which folder to copy.** `features/beranda/` and `features/kalender/` have the whole pattern. Some features differ:
the Form and SPARTA screens are in `components/form/` (with their rules in `lib/form/`), and `routes/_app/_left-navbar/`
is only "inside the shell" despite its name. Do not copy those layouts.

**Names.** The API keeps the database's English words; the web code keeps the members' Indonesian ones. An
announcement is `info` in the API and `pengumuman` in the web app; a competition is `competitions` and `lomba`;
Magang SPARTA is `internship` and `sparta`; sign-in is `auth` and `masuk`. Do not rename the API: it changes the
generated client everywhere.

**Two pages you will touch.** `lib/shell/routes.ts` is the table of pages; TypeScript refuses to build until a new
route has an entry. `lib/services.ts` is the list Layanan, Beranda and search read; a new service is one entry.

**Where a change is written down.** A new page is registered in three places: the route file with the generated
`routeTree.gen.ts` (`pnpm --filter web routes`), `lib/shell/routes.ts`, and `e2e/review/routes.ts` (the sweep). A new
capability is edited in four: `lib/capabilities.ts`, the `SERVER` table in `tests/capabilities.test.ts` (which reads
the API's check), `tests/services.test.ts` and `e2e/journeys/layanan.spec.ts`
([add a screen](recipes/add-a-screen.md), [add a service](recipes/add-a-service-to-layanan.md)).

## Rules the code enforces on itself

| Rule | Where | Runs |
| --- | --- | --- |
| Design-system lint: no raw colour, odd text size, `transition: all`, image icon, icon library, monospace or added capitals | `apps/web/eslint-rules/garis.mjs`, switched on in `apps/web/eslint.config.js` | `pnpm check` |
| Every sentence follows the glossary | `apps/web/src/copy/glossary.ts`, `apps/web/tests/copy.test.ts` | `pnpm test` |
| Service names and links are valid | `apps/web/tests/services.test.ts` | `pnpm test` |
| Every API route says who may call it, and it holds | `apps/api/src/lib/route-access.ts`, `apps/api/tests/route-access.test.ts` | `pnpm test` |
| The web's role table matches the API's checks | `apps/web/tests/capabilities.test.ts` (reads the API's route table, and its source for checks in handlers) | `pnpm test` |
| A new page has a title, parent and tab | `apps/web/tests/shell.test.ts` | `pnpm test` |
| The shell imports no feature | `apps/web/tests/testi-shell.test.ts` | `pnpm test` |
| No file nothing reaches, no unused package, no `console.log` | `apps/web/tests/no-leftovers.test.mjs` | `pnpm test` |
| Upload type and size rules match the API's | `apps/web/tests/upload-policy.test.ts` | `pnpm test` |
| Private data never reaches the device's cache | `apps/web/src/api/persistence-policy.ts`, `apps/web/tests/persistence-policy.test.ts` | `pnpm test` |
| A production build has no test login, gallery or source maps | `apps/web/scripts/verify-production-bundle.mjs` | CI |
| Route JavaScript stays under its size cap | `apps/web/scripts/budgets.mjs` | CI |
| Every journey passes the quality gates | `apps/web/e2e/support/audit.ts`, `strict.ts` | CI |
| The generated client, the migrations and the schema agree | `.github/workflows/check.yml` | CI |
| Commit messages are Conventional Commits | `scripts/commit-messages.mjs` | CI |
| No real member's details in any tracked file | `scripts/repo-privacy.test.mjs` | CI |
| The docs' links, paths and commands exist; `AGENTS.md` stays small | `scripts/docs-true.test.mjs` | CI |
| No file, export or package that nothing uses | `knip.jsonc` (`pnpm knip`) | CI |

Nothing stops an API controller from querying the database directly, and nothing checks a check that lives inside a
handler (the author, the room's owner, the audience). Review those by eye.

## One action, end to end: a member sends a Curhat message and Welfare replies

A **room** is one conversation. **Welfare** is any account with the role `curhatadmin`. A **socket** is a connection
that stays open so the server can send without being asked.

1. **The member opens Curhat.** `apps/web/src/routes/_app/_left-navbar/layanan/curhat/route.tsx` renders
   `CurhatArea` in `features/curhat/Area.tsx`. A Welfare account arriving here is sent on to `/kelola/curhat`
   (`ToInbox`).
2. **The app opens one socket for the whole area.** `useCurhatConnection` makes a `CurhatClient`
   (`features/curhat/client.ts`) around a `DeferredSocket`, which loads `socket.io-client` only now. If the device is
   offline, `DeferredSocket` reports it and tries again when the network returns.
3. **The server accepts the connection.** `apps/api/src/websocket/setup.ts` refuses a wrong origin
   (`lib/origin.ts`). `connection.ts` reads the session cookie (`session.ts`), loads the roles, and
   `registerCurhatSocket` (`curhat.ts`) joins the member to the rooms they own. When the token ends, a timer closes the
   socket.
4. **The app loads the rooms.** `GET /api/curhat/chatrooms` → `curhat.controller.ts` → `chatroom.repo.ts` →
   `toChatroomResponse` (`lib/curhat.ts`). That function is an allow-list of fields: who owns a room never leaves the
   API. Every message of every room comes in this one answer, with no paging.
5. **The member starts a room.** `POST /api/curhat/chatroom` → `createChatroomWithinLimit` locks the member's row,
   counts, then inserts, so two taps at once cannot pass the limit of three. Every connected Welfare socket joins the
   new room (`welfareJoin`).
6. **The member sends.** `CurhatClient.send` makes an id on the device (`clientMessageId`,
   [decision 9](adr/0009-curhat-messages-carry-an-id-made-on-the-device.md)), shows the message as sending, and emits
   it with a 10-second wait for the answer. With no connection it fails at once and is never queued, so it cannot be
   sent twice later. After 10 seconds it shows "Gagal" with Kirim ulang, which sends the same id again.
7. **The server saves it.** `receiveMessage` in `websocket/curhat.ts` checks the session, the rate limit (30 messages
   a minute per member, `RATE_LIMITS.curhatMessages` in `lib/limits.ts`; past it the message fails and Kirim ulang
   works once the minute is over), the payload (`CurhatMessagePayloadSchema`) and the room (`accessibleRoom` reads
   the roles again), then `saveMessage`
   (`chatroom.repo.ts`) inserts with "on conflict do nothing" on room and device id. A resend is not saved twice and
   the first copy is answered.
8. **The server passes it on.** For each other socket in the room it checks access again, then emits `reply`, built by
   `toChatroomMessageResponse`. It says `fromOwner` and `isSender`, never who. A Welfare account that lost its role is
   removed from the room instead of receiving.
9. **A push goes to the others.** `sendCurhatNotification` in `websocket/setup.ts` asks `curhatPushes`
   (`lib/curhat.ts`) who to tell: the room's owner (a link to their room) and every `curhatadmin` (a link to the room
   in the inbox), never the sender. The push carries ids only, so its text is always "Pesan baru di Curhat Yuk!".
   Their devices are sent through `sendNotificationToAll` (`lib/push-manager.ts`: 50 at a time, 10 seconds each),
   and devices the push service says are gone are deleted. A failure is logged and goes no further: the message is
   already saved.
10. **The member's app settles.** The `message` acknowledgement in `client.ts` puts the saved message in the rooms
    cache and retires the "sending" entry. If the acknowledgement was lost but the message was saved, the next fetch
    matches the device id (`settleOutbox` in `features/curhat/rules.ts`) so it never shows twice.
11. **Welfare sees it.** `/kelola/curhat` (`KelolaGate` shows nothing until the role is confirmed, then
    `features/curhat-inbox/Area.tsx`) uses the same `useCurhatConnection`. Its socket joined every room at the
    handshake; `receiveMessage` in `features/curhat/data.ts` puts the message in the room and raises the unread count.
12. **Welfare replies** from `InboxRoom.tsx` through the same `client.send`: steps 7 to 10 again, with Welfare as the
    sender.
13. **The member reads the reply.** If that room is open, `markRoomRead` calls
    `POST /api/curhat/chatroom/{id}/read` (`markChatroomRead`, safe to repeat); otherwise the unread count rises,
    which Beranda and Layanan also show. After a dropped connection the app fetches rooms and counts again.

Things this trace shows. Anonymity stops at the API: the database stores who owns each room and who sent each
message, and Welfare cannot see it through the app, but anyone with the database can. The API must run as one
process, because rooms live in its memory ([decision 10](adr/0010-the-api-runs-as-one-process-and-keeps-its-state-in-memory.md)).
Nothing from Curhat is written to the device's saved cache, and nothing from a message reaches a lock screen.

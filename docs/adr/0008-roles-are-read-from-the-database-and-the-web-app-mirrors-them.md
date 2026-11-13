# 8. Roles are read from the database on every check, and the web app mirrors them in one table

Status: accepted.

## Context
Pengurus (committee members) can do things members cannot: post in some categories, add events, run Live Counting,
answer Curhat. Roles change during the year. The web app should not show a button the API will refuse.

## Decision
- The token says who you are, not what you may do. Each check reads the member's rows in `user_roles`
  (`apps/api/src/repositories/user-role.repo.ts`), so removing a role applies at once.
- On the API, a route for named roles wraps its route in `forRoles(…)`
  (`apps/api/src/middlewares/role.middleware.ts`), so the check can't be registered apart from it. Checks that
  depend on the row stay in the handler (`roles.includes(…)`, helpers in `apps/api/src/lib/authorization.ts` and
  `apps/api/src/lib/curhat.ts`), and the live connection has its own (`apps/api/src/websocket/`).
- Every route has a row in `apps/api/src/lib/route-access.ts` saying who may call it.
  `apps/api/tests/route-access.test.ts` fails on a route with no row and checks every row with requests.
- The web app has one table, `apps/web/src/lib/capabilities.ts`, that says which roles may do what, and every
  pengurus action is shown through `can()`.
- `apps/web/tests/capabilities.test.ts` keeps the two sides honest: it reads the API's route table (and its source,
  for the checks inside handlers) and fails when a row of the web's table no longer matches.

## What else was possible
- Roles inside the token: faster, but a removed role would last until the token ends.
- The server sending the web app a list of what the member may do: no copy to keep, but a new route and a new shape
  to maintain.

## What it costs
- One extra small query per check.
- The route table repeats each controller's roles; the route test keeps them equal. A check inside a handler is only
  a note in the table, so it is checked by its own route test and by eye.
- For the checks inside handlers, the mirror test still reads the API's source with regular expressions. Moving
  that code can break it.

## When to revisit
When the roles outgrow one table or the server's checks cause a mistake.

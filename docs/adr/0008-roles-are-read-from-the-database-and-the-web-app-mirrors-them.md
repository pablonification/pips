# 8. Roles are read from the database on every check, and the web app mirrors them in one table

Status: accepted.

## Context
Pengurus (committee members) can do things members cannot: post in some categories, add events, run Live Counting,
answer Curhat. Roles change during the year. The web app should not show a button the API will refuse.

## Decision
- The token says who you are, not what you may do. Each check reads the member's rows in `user_roles`
  (`apps/api/src/repositories/user-role.repo.ts`), so removing a role applies at once.
- On the API a check is written in several places: `roleMiddleware([...])` registered on a path
  (`apps/api/src/middlewares/role.middleware.ts`), `roles.includes(…)` inside a handler, helpers in
  `apps/api/src/lib/authorization.ts` and `apps/api/src/lib/curhat.ts`, and the live connection's own check
  (`apps/api/src/websocket/`).
- The web app has one table, `apps/web/src/lib/capabilities.ts`, that says which roles may do what, and every
  pengurus action is shown through `can()`.
- `apps/web/tests/capabilities.test.ts` keeps the two sides honest: it reads the API's source files and fails when
  a row of the table no longer matches a check there.

## What else was possible
- Roles inside the token: faster, but a removed role would last until the token ends.
- The server sending the web app a list of what the member may do: no copy to keep, but a new route and a new shape
  to maintain.

## What it costs
- One extra small query per check.
- The server's checks are written four different ways. If a new route forgets to register its role check, the route
  is open to every signed-in member, and the web test would not notice: it only reads the checks that exist.
- The mirror test reads the API's source with regular expressions. Moving a role list into another file can break
  it.

## When to revisit
When the roles outgrow one table or the server's checks cause a mistake. The usual first step is a single helper
that takes the route, the roles and the handler together, plus a test that walks the API's OpenAPI document and
calls every role-protected route as a plain member.

# 7. The session is a signed token in a cookie, and the API keeps no session table

Status: accepted.

## Context
Only people already in the `users` table can sign in, with their Google account. After that the app has to know who
is calling on every request, for weeks, without asking Google again.

## Decision
- At sign-in the API checks the Google token, finds the member, signs a token (a JWT) with `JWT_SECRET` and sets it
  as a cookie: `apps/api/src/controllers/auth.controller.ts`, `apps/api/src/lib/session-cookie.ts`.
- The cookie is `httpOnly` (the page's own code cannot read it), `Secure` and `SameSite=Lax`, and it lasts as long
  as `TOKEN_EXPIRATION` says (a number of seconds; `.env.example` has 2592000, which is 30 days).
- The web app and the API must be on the same site (`app.hmif.dev` and `app-api.hmif.dev`), so other websites'
  requests never carry a member's cookie.
- There is no table of sessions. The token is valid until its end time. The algorithm is fixed in
  `apps/api/src/lib/jwt.ts`.
- The web app signs a member out only when the session check answers 401 (`apps/web/src/lib/session-policy.ts`). A
  dropped connection or a server error keeps the member on screen.

## What else was possible
- A session table: can end one device's session, but costs a database read on every request.
- A short token plus a refresh token: shorter exposure, much more code on both sides.
- A ready-made auth library: less code to own, but a different sign-in flow from the one members know.

## What it costs
- A lost or stolen phone stays signed in until the token ends. "Keluar" removes the cookie on that device only.
  Changing `JWT_SECRET` signs everybody out at once.
- The end time is fixed at sign-in; using the app does not extend it. When it passes, the web app wipes the
  member's data from the device (see 0013), form drafts included.
- `TOKEN_EXPIRATION` accepts any text. `1h` gives a session of one second, because the value is read as seconds.
- Hosting the web app on another domain makes sign-in stop working without an error.
- The token holds the member's profile fields (name, NIM, email, angkatan), so a changed name shows only after the
  next sign-in.

## When to revisit
When the app needs to end a session remotely (a lost device report) or when members complain about being signed out
mid-task. Renewing the cookie while it is used is the smaller fix; a session table is the bigger one.

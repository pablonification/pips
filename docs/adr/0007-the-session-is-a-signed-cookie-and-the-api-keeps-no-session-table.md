# 7. The session is a signed token in a cookie, and the API keeps no session table

Status: accepted.

## Context
Only people already in the `users` table can sign in, with their Google account. After that the app has to know who
is calling on every request, for weeks, without asking Google again.

## Decision
- At sign-in the API checks the Google token, finds the member, signs a token (a JWT) with `JWT_SECRET` and sets it
  as a cookie: `apps/api/src/controllers/auth.controller.ts`, `apps/api/src/lib/session-cookie.ts`.
- The cookie is `httpOnly` (the page's own code cannot read it), `Secure` and `SameSite=Lax`, and it lasts as long
  as `TOKEN_EXPIRATION` says (whole seconds, at least 60; `.env.example` has 2592000, which is 30 days).
- A wrong setting stops the API at start: `JWT_SECRET` must be at least 32 characters and `TOKEN_EXPIRATION` a whole
  number (`apps/api/src/configs/env.schema.ts`).
- A session renews itself with use. When the web app checks the session (`GET /api/me`) and the token is past half
  its life, the API reads the member again, signs a new token and sets the cookie again. The token also records
  when the member first signed in, and a renewal is refused 180 days after that, so everybody signs in again at
  least twice a year (`MAX_SESSION_AGE_SECONDS` in `auth.controller.ts`). A member who is no longer in the `users`
  table gets a 401 instead of a new cookie.
- The web app and the API must be on the same site (`app.hmif.dev` and `app-api.hmif.dev`), so other websites'
  requests never carry a member's cookie.
- There is no table of sessions. A token is valid until its end time. The algorithm is fixed in
  `apps/api/src/lib/jwt.ts`.
- The web app signs a member out only when the session check answers 401 (`apps/web/src/lib/session-policy.ts`). A
  dropped connection or a server error keeps the member on screen.

## What else was possible
- A session table: can end one device's session, but costs a database read on every request.
- A short token plus a refresh token: shorter exposure, much more code on both sides.
- A ready-made auth library: less code to own, but a different sign-in flow from the one members know.

## What it costs
- A lost or stolen phone stays signed in until its token ends, and a phone in use can be renewed for up to 180
  days. "Keluar" removes the cookie on that device only. Changing `JWT_SECRET` signs everybody out at once.
- A member removed from the `users` table is noticed only when the token comes up for renewal (past half its
  life), not on every request.
- When a token ends without being renewed, the web app wipes the member's data from the device (see 0013), form
  drafts included.
- Hosting the web app on another domain makes sign-in stop working without an error.
- The token holds the member's profile fields (name, NIM, email, angkatan), so a changed name shows only at the
  next renewal or sign-in.

## When to revisit
When the app needs to end a session remotely (a lost device report), or when removing a member must take effect at
once. That needs a session table, or a check of the `users` row on every request.

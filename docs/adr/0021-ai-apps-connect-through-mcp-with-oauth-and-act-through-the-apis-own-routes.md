# 21. AI apps connect through MCP with OAuth, and act only through the API's own routes

Status: accepted.

## Context

Members asked to use PIPS! from an AI app (Claude, ChatGPT, Claude Code): read Pengumuman, see Kalender, send a Form,
and for pengurus, the Kelola tools. MCP (Model Context Protocol) is how those apps reach a service, and its standard
sign-in is OAuth 2.1. The hard part is not the protocol: it is keeping every rule the app already has (a role, an
angkatan, the author of a post, Curhat's anonymity) without writing them a second time.

## Decision

- **One endpoint, `/mcp`, in the one API process** (decision 10): Streamable HTTP, stateless, with the official
  TypeScript SDK (`@modelcontextprotocol/sdk`). `apps/api/src/controllers/mcp.controller.ts`.
- **The API is its own OAuth server**, built by hand on the standards, with no auth library:
  protected-resource metadata (RFC 9728), server metadata (RFC 8414), dynamic client registration for public
  clients only (RFC 7591), the authorization code with PKCE S256 required, and refresh tokens that rotate, where a
  reused refresh token or code revokes everything it gave. `apps/api/src/controllers/oauth.controller.ts`, rules in
  `apps/api/src/lib/oauth.ts`, storage in `apps/api/src/repositories/oauth.repo.ts`.
- **Tokens are random, stored only as SHA-256 hashes**, bound to the member, the app and the scopes. An access token
  lasts an hour, a refresh token 30 days. Two scopes: `pips.read`, and `pips.write` for any tool that changes
  something. A token without `pips.write` doesn't see the writing tools at all.
- **The member approves in the web app.** `GET /oauth/authorize` stores the request and sends the browser to
  `/hubungkan` with only the request's id. That page reads and answers the request through ordinary member routes
  under `/api/oauth/…`, so the session cookie and the origin check for writes apply as everywhere else. The app's
  name is shown as plain text, with the host it returns to. When the app asks for `pips.write`, the member chooses
  Baca dan ubah or Hanya baca. Approval may only narrow what the app asked for (`narrowScope`), never widen it, and
  always keeps `pips.read`; the code and every token after it carry the narrowed scopes. Most MCP apps ask for every
  scope the server lists, so without this choice a member couldn't connect one to read only.
- **Every tool calls an existing route, in the process, as the member.** For each MCP request the API checks the
  token, reads the member again, and signs a five-minute session the way sign-in does (same payload, same secret,
  `apps/api/src/lib/session-token.ts`). Each tool then sends a request to the API app itself with that session
  (`apps/api/src/mcp/tools.ts`). The route's own checks decide: a tool never checks a role, an angkatan or an author,
  and a refusal comes back to the model as the route said it. Rate limits for writes and NIM Finder apply as in the
  app, plus 120 MCP requests a minute per member.
- **Never a tool:** Curhat Yuk! (a model reading or writing in a room is exactly what its anonymity promise rules
  out), push devices, sign-in routes, file uploads and the test sign-in. There is no tool that sends a request of the
  model's choosing; each tool names its route.
- **The member sees and revokes apps** in Profil › Aplikasi terhubung (`/profil/aplikasi`). Revoking ends every token
  that app holds for them at once. A member removed from `users` loses every token with them (the foreign key), and a
  token for a member who no longer exists is refused anyway.

## What else was possible

- **A personal access token pasted into the app:** less code, but it lives for months in a settings box, and claude.ai
  and ChatGPT connectors expect OAuth.
- **An OAuth library or a hosted provider:** less to write, but a second account system next to Google sign-in, and
  the tokens would still have to become a PIPS! member for the routes.
- **Tools that query the database directly:** faster, and every role, audience and author rule written twice; the
  first one forgotten is a leak.

## What it costs

- About a thousand lines that are ours to keep correct: OAuth is easy to get subtly wrong. The tests in
  `apps/api/tests/oauth.test.ts`, `mcp.test.ts` and `tests/db/oauth.test.ts` hold the rules (a concurrent refresh, a
  reused code), and they are the first thing to read before changing it.
- Each tool call is a second request inside the process (logging, middleware, a session signature). Fine at this size.
- The API keeps no session table (decision 7), but MCP tokens are a table: revoking an app takes effect at once,
  unlike a lost phone's cookie. "Keluar" signs out one device and does not revoke apps; there is no "sign out
  everywhere".
- A tool's answer is the route's answer trimmed for the model, so a route that changes shape can change what a tool
  says. The tools pick fields; they never add any.
- Anyone can register an app (that is how MCP clients work); registration is rate-limited per address and grants
  nothing until a member approves. Old registrations are never swept.

## When to revisit

When a route a tool calls changes its checks or shape (update the tool's description), when members want an app to
reach Curhat (no: see above), or when the API runs as more than one process (the rate limits and the in-process
dispatch both assume one). A tool to delete a form waits until the owner decides who may delete one; the others in
Kelola › Form (make, change, publish, rename the link, share) are tools.

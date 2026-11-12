# 10. The API runs as exactly one process and keeps its live state in memory

Status: accepted.

## Context
A server with a few thousand users does not need a cluster. But some things (rate limits, who is in which chat
room, a job that runs every minute) have to live somewhere, and the simplest place is the process itself.

## Decision
- Rate limits are counters in memory (`apps/api/src/lib/rate-limit.ts`, used from `apps/api/src/app.ts`).
- The Curhat and Live Counting rooms are socket.io rooms in the process (`apps/api/src/websocket/`).
- Pushes are sent from the process itself, a few at a time, after the request has been answered
  (`apps/api/src/lib/background.ts`, `apps/api/src/lib/push-manager.ts`).
- The calendar reminder job runs inside the process, every minute, when `NODE_ENV` is `production`
  (`apps/api/src/cron/`). A failed run is logged and the server keeps going.
- On a stop signal the process finishes the requests and pushes in flight, then exits (`apps/api/src/lib/shutdown.ts`).

## What else was possible
- Redis for limits and rooms, a job queue for pushes, a separate worker for the reminder job: correct for many
  copies of the API, and three more things to run, pay for and learn.

## What it costs
- The API must never run as two copies. Limits would double, chat members would be split between copies, and every
  reminder would be sent twice. Nothing in the code enforces this: say it in the deploy settings.
- A restart forgets the rate limits, drops every open socket (the web app reconnects) and loses the pushes and
  reminders due at that moment: nothing is queued.
- A deploy replaces the one process, so open chat connections drop for a moment while it restarts.

## When to revisit
When one process is no longer enough (slow responses under load) or when a restart losing reminders becomes a
complaint. The first fix is to store the reminder state in the database; moving to several copies needs the rest.

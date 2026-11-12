# 9. Curhat Yuk! uses one live connection, and every message carries an id made on the device

Status: accepted.

## Context
Curhat Yuk! is an anonymous chat between a member and HMIF Welfare. A message must never be lost and never shown
twice, on phones whose connection drops all the time. The hard case: the server saves a message, but the answer
"saved" never reaches the phone. The member taps "Kirim ulang", and the same message must not appear twice.

## Decision
- One socket.io connection serves the whole Curhat area. The web side is `apps/web/src/features/curhat/client.ts`
  (the rules are in `rules.ts`, and the same client serves Welfare's inbox in `features/curhat-inbox/`); the server
  side is `apps/api/src/websocket/curhat.ts`. The chat code loads only inside Curhat, so other pages stay light.
- The device makes an id (`clientMessageId`, a UUID) for every message. "Kirim ulang" sends the same id again.
- The database refuses a second message with the same id in the same room: a unique index on room and device id
  (`chatroom_messages_client_message_idx` in `apps/api/src/db/schema.ts`) and `ON CONFLICT DO NOTHING` in
  `saveMessage` (`apps/api/src/repositories/chatroom.repo.ts`). A repeat is answered with the copy that was saved.
- A message is sent only while connected, so socket.io never queues it and sends it later by itself. If the
  connection is down or no answer comes in 10 seconds, the message shows "Gagal".
- Anonymity is kept by what the API sends. Messages carry `fromOwner` and `isSender`, never a user id
  (`apps/api/src/lib/curhat.ts`). A member may have at most three rooms.
- A member, and each Welfare member, may send 30 messages a minute (`RATE_LIMITS.curhatMessages` in
  `apps/api/src/lib/limits.ts`, counted in memory for every socket together).
- A notification carries no text from a message, a room or a sender. It says only "Pesan baru di Curhat Yuk!" and
  opens the room: the member's own, or the room in Welfare's inbox (`curhatPushes` in `apps/api/src/lib/curhat.ts`).

## What else was possible
- Plain requests with polling: simpler, but slow to show a reply and wasteful on a phone.
- Raw WebSocket or server-sent events: socket.io was already in the app and handles reconnecting.
- Letting the server make the ids: it cannot know that two sends are the same message when the first answer was lost.

## What it costs
- It is the largest piece of client logic in the app and has the largest tests (`apps/web/tests/curhat-client.test.ts`,
  `apps/api/tests/curhat-socket.test.ts`, `apps/api/tests/db/curhat.test.ts`).
- A failed message lives only in memory. Leaving the Curhat area or closing the app drops it.
- Anonymity stops at the API's edge. The database still stores who owns each room and who wrote each message, and
  anyone with database access can read it. Welfare cannot see it through the app, and a lock screen shows nothing
  of a message.
- Messages from older app versions have no id, so the repeat protection does not cover them.

## When to revisit
When the unsent-message loss bothers members (keep unsent messages per room in the browser's session storage), or
when anonymity needs to hold against database access (that means storing less, which is a product decision for
HMIF Welfare).

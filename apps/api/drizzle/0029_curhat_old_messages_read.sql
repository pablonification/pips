-- Read marks for the Curhat messages that exist when this runs: the app before the redesign wrote none, so without
-- them every old message from the other side would count as unread. Only adds marks, and is safe to run twice.
-- A room's owner has read every message in it they didn't send.
INSERT INTO "chatroom_message_reads" ("user_id", "chatroom_message_id")
SELECT "chatrooms"."user_id", "chatroom_messages"."id"
FROM "chatroom_messages"
INNER JOIN "chatrooms" ON "chatrooms"."id" = "chatroom_messages"."chatroom_id"
WHERE "chatrooms"."user_id" IS NOT NULL
  AND "chatroom_messages"."user_id" <> "chatrooms"."user_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Each Welfare member has read every message they didn't send, except a member's messages with no reply after
-- them: those rooms are still waiting for an answer.
WITH "last_reply" AS (
  SELECT DISTINCT ON ("chatroom_messages"."chatroom_id")
    "chatroom_messages"."chatroom_id", "chatroom_messages"."created_at", "chatroom_messages"."id"
  FROM "chatroom_messages"
  INNER JOIN "chatrooms" ON "chatrooms"."id" = "chatroom_messages"."chatroom_id"
  WHERE "chatrooms"."user_id" IS NULL OR "chatroom_messages"."user_id" <> "chatrooms"."user_id"
  ORDER BY "chatroom_messages"."chatroom_id", "chatroom_messages"."created_at" DESC, "chatroom_messages"."id" DESC
)
INSERT INTO "chatroom_message_reads" ("user_id", "chatroom_message_id")
SELECT "welfare"."user_id", "chatroom_messages"."id"
FROM "chatroom_messages"
INNER JOIN "chatrooms" ON "chatrooms"."id" = "chatroom_messages"."chatroom_id"
LEFT JOIN "last_reply" ON "last_reply"."chatroom_id" = "chatroom_messages"."chatroom_id"
CROSS JOIN (SELECT DISTINCT "user_id" FROM "user_roles" WHERE "role" = 'curhatadmin') AS "welfare"
WHERE "chatroom_messages"."user_id" <> "welfare"."user_id"
  AND (
    "chatrooms"."user_id" IS NULL
    OR "chatroom_messages"."user_id" <> "chatrooms"."user_id"
    OR ("last_reply"."created_at", "last_reply"."id") > ("chatroom_messages"."created_at", "chatroom_messages"."id")
  )
ON CONFLICT DO NOTHING;

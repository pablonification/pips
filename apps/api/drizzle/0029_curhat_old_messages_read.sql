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
INSERT INTO "chatroom_message_reads" ("user_id", "chatroom_message_id")
SELECT "welfare"."user_id", "chatroom_messages"."id"
FROM "chatroom_messages"
INNER JOIN "chatrooms" ON "chatrooms"."id" = "chatroom_messages"."chatroom_id"
CROSS JOIN (SELECT DISTINCT "user_id" FROM "user_roles" WHERE "role" = 'curhatadmin') AS "welfare"
WHERE "chatroom_messages"."user_id" <> "welfare"."user_id"
  AND (
    "chatrooms"."user_id" IS NULL
    OR "chatroom_messages"."user_id" <> "chatrooms"."user_id"
    OR EXISTS (
      SELECT 1 FROM "chatroom_messages" AS "later"
      WHERE "later"."chatroom_id" = "chatroom_messages"."chatroom_id"
        AND "later"."user_id" <> "chatrooms"."user_id"
        AND ("later"."created_at", "later"."id") > ("chatroom_messages"."created_at", "chatroom_messages"."id")
    )
  )
ON CONFLICT DO NOTHING;

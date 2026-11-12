-- The PIXEL form was created before a question could say what to prefill: mark its name (q1) and NIM (q2) questions.
-- Matches that one form by its slug, keeps every section and question in order, and leaves a form already marked as it
-- is. The app before the redesign ignores the extra key.
UPDATE "forms" SET "sections" = (
  SELECT jsonb_agg(
    jsonb_set("section", '{questions}', (
      SELECT COALESCE(jsonb_agg(
        CASE "question"->>'id'
          WHEN 'q1' THEN "question" || '{"prefill":"fullName"}'
          WHEN 'q2' THEN "question" || '{"prefill":"nim"}'
          ELSE "question" END
        ORDER BY "qi"), '[]'::jsonb)
      FROM jsonb_array_elements("section"->'questions') WITH ORDINALITY AS "qq"("question", "qi")))
    ORDER BY "si")
  FROM jsonb_array_elements("forms"."sections"::jsonb) WITH ORDINALITY AS "ss"("section", "si"))::json
WHERE "slug" = 'pixel-analisis-kondisi-2025'
  AND json_array_length("sections") > 0
  AND NOT EXISTS (
    SELECT 1
    FROM json_array_elements("forms"."sections") AS "s"("section"),
      json_array_elements("s"."section"->'questions') AS "q"("question")
    WHERE "q"."question"->>'prefill' IS NOT NULL
  );

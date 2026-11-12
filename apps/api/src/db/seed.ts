/**
 * Fills a migrated database with the made-up HMIF in `seed/sample-hmif.ts` and the form in `seed/pixel-form-seed.ts`,
 * then exits. Safe to run again: a row that is already there is left as it is, except that the sample's own events
 * and courses taken move to today's month and semester. Runs only when `APP_ENV` is `development`, so it never
 * writes sample people into a database of real members.
 *
 *   pnpm --filter api db:seed
 */
import 'dotenv/config';
import { and, eq, ne, or } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { PgTable } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from './schema';
import { runPixelFormSeed } from './seed/pixel-form-seed';
import { sampleHmif } from './seed/sample-hmif';

export type SeedCounts = Record<string, number>;

/** Inserts the sample into `url` and returns how many rows of each kind it added (0 for a row already there). */
export async function runSeed({
  url = process.env.DATABASE_URL,
  appEnv = process.env.APP_ENV,
  now = new Date(),
}: { url?: string; appEnv?: string; now?: Date } = {}): Promise<SeedCounts> {
  if (appEnv !== 'development') {
    throw new Error(
      `The seed runs only with APP_ENV=development (it is ${appEnv ?? 'unset, which means production'}).`,
    );
  }
  if (!url) throw new Error('DATABASE_URL is required');

  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });
  try {
    return await db.transaction(async (tx) => {
      const sample = sampleHmif(now);
      const counts: SeedCounts = {};
      const add = async <T extends PgTable>(
        label: string,
        table: T,
        rows: Array<T['$inferInsert']>,
      ) => {
        const added = await tx
          .insert(table)
          .values(rows)
          .onConflictDoNothing()
          .returning();
        counts[label] = added.length;
      };
      // In this order: each table's rows point at rows added before it.
      await add('angkatan', schema.angkatan, sample.angkatanRows);
      await add('members', schema.users, sample.userRows);
      await add('roles', schema.userRoles, sample.roleRows);
      await add('categories', schema.categories, sample.categoryRows);
      await add('courses', schema.courses, sample.courseRows);

      // An angkatan, category or course may already exist under another id (the test login adds angkatan 2025), so
      // later rows point at whichever row holds the year, name or code.
      const angkatanId = idsBy(
        sample.angkatanRows,
        await tx.select().from(schema.angkatan),
        (r) => r.year,
      );
      const categoryId = idsBy(
        sample.categoryRows,
        await tx.select().from(schema.categories),
        (r) => r.name,
      );
      const courseId = idsBy(
        sample.courseRows,
        await tx.select().from(schema.courses),
        (r) => r.code,
      );

      await add(
        'courses taken',
        schema.userCourses,
        sample.userCourseRows.map((r) => ({
          ...r,
          courseId: courseId(r.courseId),
        })),
      );
      await add('announcements', schema.infos, sample.infoRows);
      await add(
        'announcement angkatan',
        schema.infoAngkatan,
        sample.infoAngkatanRows.map((r) => ({
          ...r,
          angkatanId: angkatanId(r.angkatanId),
        })),
      );
      await add(
        'announcement categories',
        schema.infoCategories,
        sample.infoCategoryRows.map((r) => ({
          ...r,
          categoryId: categoryId(r.categoryId),
        })),
      );
      await add('comments', schema.comments, sample.commentRows);
      await add('reactions', schema.reactions, sample.reactionRows);
      await add(
        'calendar groups',
        schema.calendarGroup,
        sample.calendarGroupRows,
      );
      await add(
        'calendar events',
        schema.calendarEvent,
        sample.eventRows.map((r) => ({
          ...r,
          courseId: r.courseId ? courseId(r.courseId) : r.courseId,
        })),
      );
      await add('competitions', schema.competitions, sample.competitionRows);
      await add(
        'testimonials',
        schema.testimonies,
        sample.testimonyRows.map((r) => ({
          ...r,
          courseId: courseId(r.courseId),
        })),
      );
      await add('Curhat rooms', schema.chatrooms, sample.chatroomRows);
      await add(
        'Curhat messages',
        schema.chatroomMessages,
        sample.chatroomMessageRows,
      );
      await add(
        'Curhat reads',
        schema.chatroomMessageReads,
        sample.chatroomReadRows,
      );
      counts.forms = await runPixelFormSeed(
        tx as unknown as PostgresJsDatabase<typeof schema>,
      );

      // Seeded on an earlier day: the sample's events and courses taken follow today, so Kalender and Mata kuliahku
      // still show them. Only the sample's own rows move.
      let moved = 0;
      for (const { id, start, end } of sample.eventRows) {
        if (!id) continue;
        const { calendarEvent: e } = schema;
        const rows = await tx
          .update(e)
          .set({ start, end })
          .where(and(eq(e.id, id), or(ne(e.start, start), ne(e.end, end))))
          .returning({ id: e.id });
        moved += rows.length;
      }
      for (const row of sample.userCourseRows) {
        const { userCourses: u } = schema;
        const rows = await tx
          .update(u)
          .set({
            semesterCodeTaken: row.semesterCodeTaken,
            semesterYearTaken: row.semesterYearTaken,
          })
          .where(
            and(
              eq(u.userId, row.userId),
              eq(u.courseId, courseId(row.courseId)),
              or(
                ne(u.semesterCodeTaken, row.semesterCodeTaken),
                ne(u.semesterYearTaken, row.semesterYearTaken),
              ),
            ),
          )
          .returning({ courseId: u.courseId });
        moved += rows.length;
      }
      counts['moved to today'] = moved;
      return counts;
    });
  } finally {
    await client.end();
  }
}

/** Maps a sample row's id to the id of the stored row with the same key. */
function idsBy<R extends { id?: string }, K>(
  sampleRows: R[],
  stored: Array<R & { id: string }>,
  key: (row: R) => K,
) {
  const storedId = new Map(stored.map((row) => [key(row), row.id]));
  const byId = new Map(
    sampleRows.map((row) => [row.id, storedId.get(key(row))]),
  );
  return (id: string) => {
    const found = byId.get(id);
    if (!found) throw new Error(`The sample row ${id} was not stored`);
    return found;
  };
}

if (require.main === module) {
  runSeed()
    .then((counts) => {
      console.log('Seeded (rows added; 0 means they were already there):');
      for (const [label, n] of Object.entries(counts))
        console.log(`  ${label}: ${n}`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

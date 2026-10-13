import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';

/*
 * OPEN-QUESTIONS C2: `PUT /api/course/take/batch` upserted on (user, course) and updated only the class. A course
 * taken in an earlier semester and added again kept its old semester, so it never showed in this semester's courses
 * (Mata kuliahku) and stayed in the catalogue. The upsert now moves it to this semester.
 */

before(() => {
  usePlaceholderEnv();
});

test('adding a course again moves it to this semester, with the new class', async () => {
  const { db } = await import('../src/db/drizzle');
  const { batchUpsertUserCourseQuery, getCurrentSemesterCodeAndYear } =
    await import('../src/repositories/course.repo');
  const { sql, params } = batchUpsertUserCourseQuery(
    db,
    [{ courseId: 'course-IF2211', class: 2 }],
    'u-nadia',
  ).toSQL();
  const update = sql.slice(sql.indexOf('on conflict'));
  assert.match(update, /^on conflict \("user_id","course_id"\) do update set/);
  assert.match(update, /"class" = excluded\.class/);
  assert.match(update, /"semester_code_taken" = excluded\.semester_code_taken/);
  assert.match(update, /"semester_year_taken" = excluded\.semester_year_taken/);
  // The inserted row is this semester's.
  const { semesterCodeTaken, semesterYearTaken } =
    getCurrentSemesterCodeAndYear();
  assert.deepEqual(params, [
    'u-nadia',
    'course-IF2211',
    2,
    semesterCodeTaken,
    semesterYearTaken,
  ]);
});

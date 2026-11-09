import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';

/*
 * Garis v5 dropped the class from Mata kuliahku: Tambah mata kuliah sends only `courseId`. `PUT /api/course/take/batch`
 * (and `POST /api/course/take`) used to require `class`, so those adds failed with 400. A missing class is now stored as
 * the default class; an older client that still sends one keeps it.
 */

before(async () => {
  usePlaceholderEnv();
  // The schemas call `.openapi()`, which zod has once the routes load (as in the running app).
  await import('../src/routes/course.route');
});

test('a new client sends no class: the course is stored with the default class', async () => {
  const { BatchCreateOrUpdateUserCourseSchema, DEFAULT_COURSE_CLASS } =
    await import('../src/types/course.types');
  const { db } = await import('../src/db/drizzle');
  const { batchUpsertUserCourseQuery } = await import(
    '../src/repositories/course.repo'
  );
  const parsed = BatchCreateOrUpdateUserCourseSchema.parse([
    { courseId: 'course-IF2211' },
    { courseId: 'course-IF2230' },
  ]);
  assert.deepEqual(parsed, [
    { courseId: 'course-IF2211', class: DEFAULT_COURSE_CLASS },
    { courseId: 'course-IF2230', class: DEFAULT_COURSE_CLASS },
  ]);
  assert.equal(DEFAULT_COURSE_CLASS, 1);
  // The insert never leaves the NOT NULL column empty.
  const { params } = batchUpsertUserCourseQuery(db, parsed, 'u-nadia').toSQL();
  assert.deepEqual(
    params.filter((p) => typeof p === 'number' && p < 100),
    [1, 1],
  );
});

test('an old client still sends a class: it is kept', async () => {
  const { BatchCreateOrUpdateUserCourseSchema, CreateUserCourseSchema } =
    await import('../src/types/course.types');
  assert.deepEqual(
    BatchCreateOrUpdateUserCourseSchema.parse([
      { courseId: 'course-IF2211', class: 2 },
      { courseId: 'course-IF2230' },
    ]),
    [
      { courseId: 'course-IF2211', class: 2 },
      { courseId: 'course-IF2230', class: 1 },
    ],
  );
  assert.deepEqual(
    CreateUserCourseSchema.parse({ courseId: 'course-IF2211', class: 3 }),
    { courseId: 'course-IF2211', class: 3 },
  );
  assert.deepEqual(CreateUserCourseSchema.parse({ courseId: 'course-IF2211' }), {
    courseId: 'course-IF2211',
    class: 1,
  });
});

test('a class that is not a number is still refused, and a course id is still required', async () => {
  const { BatchCreateOrUpdateUserCourseSchema } = await import(
    '../src/types/course.types'
  );
  assert.equal(
    BatchCreateOrUpdateUserCourseSchema.safeParse([
      { courseId: 'course-IF2211', class: 'K2' },
    ]).success,
    false,
  );
  assert.equal(
    BatchCreateOrUpdateUserCourseSchema.safeParse([{ class: 1 }]).success,
    false,
  );
});

test('the API document no longer lists class as required, so the generated web client may leave it out', async () => {
  const { createApp, openApiDocument } = await import('../src/app');
  const doc = JSON.parse(JSON.stringify(openApiDocument(createApp())));
  const op = doc.paths['/api/course/take/batch'].put;
  let item = op.requestBody.content['application/json'].schema.items;
  if (item.$ref) item = doc.components.schemas[item.$ref.split('/').pop()];
  assert.deepEqual(item.required, ['courseId']);
  assert.equal(item.properties.class.type, 'number');
  assert.equal(item.properties.class.default, 1);
});

import postgres from 'postgres';
import { db } from '~/db/drizzle';
import { COURSE_CATALOG_MANAGER_ROLES } from '~/lib/authorization';
import { forRoles } from '~/middlewares/role.middleware';
import {
  batchCreateOrUpdateUserCourse,
  createCourse,
  createUserCourse,
  deleteCourse,
  deleteUserCourse,
  getCourseById,
  getListCourses,
  getUserCourse,
  updateCourse,
} from '~/repositories/course.repo';
import { getUserRoles } from '~/repositories/user-role.repo';
import {
  createCourseRoute,
  createOrUpdateBatchUserCourseRoute,
  createUserCourseRoute,
  deleteCourseRoute,
  deleteUserCourseRoute,
  getCourseByIdRoute,
  getCurrentUserCourseRoute,
  getUserCourseRoute,
  listCourseRoute,
  updateCourseRoute,
} from '~/routes/course.route';
import { CourseSchema } from '~/types/course.types';
import { withDb, type WithoutDb } from './deps';
import { createAuthRouter } from './router-factory';

/** Who may change the catalog is read through `deps`, so the route tests run without a database. */
export interface CourseDeps {
  getUserRoles: WithoutDb<typeof getUserRoles>;
}

export function createCourseRouter(
  deps: CourseDeps = { getUserRoles: withDb(getUserRoles) },
) {
  const courseRouter = createAuthRouter();

  courseRouter.openapi(createUserCourseRoute, async (c) => {
    try {
      const userId = c.var.user.id;
      const data = c.req.valid('json');
      const newUserCourse = await createUserCourse(db, data, userId);
      return c.json(newUserCourse, 201);
    } catch (err) {
      if (err instanceof postgres.PostgresError) {
        if (err.code === '23503')
          return c.json({ error: 'Course not found' }, 404);
        return c.json({ error: 'Course has already been taken' }, 400);
      }
      throw err;
    }
  });

  courseRouter.openapi(getUserCourseRoute, async (c) => {
    const userId = c.var.user.id;
    const userCourses = await getUserCourse(db, userId);
    return c.json(userCourses, 200);
  });

  courseRouter.openapi(getCurrentUserCourseRoute, async (c) => {
    const userId = c.var.user.id;
    const userCourses = await getUserCourse(db, userId, true);
    return c.json(userCourses, 200);
  });

  courseRouter.openapi(deleteUserCourseRoute, async (c) => {
    const userId = c.var.user.id;
    const { courseIds } = c.req.valid('json');
    const userCourse = await deleteUserCourse(db, userId, courseIds);

    if (userCourse.length === 0)
      return c.json({ error: 'Course not found' }, 404);
    return c.json(userCourse, 200);
  });

  courseRouter.openapi(listCourseRoute, async (c) => {
    const courses = await getListCourses(db, c.req.valid('query'));
    return c.json(
      {
        courses,
      },
      200,
    );
  });

  courseRouter.openapi(getCourseByIdRoute, async (c) => {
    const { courseId } = c.req.valid('param');
    const course = await getCourseById(db, courseId);

    if (!course) return c.json({ error: 'Course not found' }, 404);
    return c.json(course, 200);
  });

  courseRouter.openapi(
    forRoles(
      createCourseRoute,
      COURSE_CATALOG_MANAGER_ROLES,
      deps.getUserRoles,
    ),
    async (c) => {
      try {
        const data = c.req.valid('json');
        const newCourse = CourseSchema.parse(await createCourse(db, data));
        return c.json(newCourse, 201);
      } catch (err) {
        if (err instanceof postgres.PostgresError)
          return c.json({ error: 'Course has already been created' }, 400);
        throw err;
      }
    },
  );

  courseRouter.openapi(
    forRoles(
      updateCourseRoute,
      COURSE_CATALOG_MANAGER_ROLES,
      deps.getUserRoles,
    ),
    async (c) => {
      const data = c.req.valid('json');
      const { courseId } = c.req.valid('param');
      const course = await updateCourse(db, data, courseId);

      if (!course) return c.json({ error: 'Course not found' }, 404);
      return c.json(course, 200);
    },
  );

  courseRouter.openapi(
    forRoles(
      deleteCourseRoute,
      COURSE_CATALOG_MANAGER_ROLES,
      deps.getUserRoles,
    ),
    async (c) => {
      const { courseId } = c.req.valid('param');
      const course = await deleteCourse(db, courseId);

      if (!course) return c.json({ error: 'Course not found' }, 404);
      return c.json(course, 200);
    },
  );

  courseRouter.openapi(createOrUpdateBatchUserCourseRoute, async (c) => {
    const userId = c.var.user.id;
    const data = c.req.valid('json');

    const existingCourses = await Promise.all(
      data.map(async (d) => {
        if (await getCourseById(db, d.courseId)) return d;
      }),
    );

    const validCourses = existingCourses.filter(
      (d) => d !== undefined,
    ) as Array<{
      courseId: string;
      class: number;
    }>;

    if (validCourses.length !== data.length) {
      return c.json({ error: 'Some courses not found' }, 404);
    }

    const userCourses = await batchCreateOrUpdateUserCourse(
      db,
      validCourses,
      userId,
    );
    return c.json(userCourses, 201);
  });

  return courseRouter;
}

export const courseRouter = createCourseRouter();

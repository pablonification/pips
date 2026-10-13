import { roleMiddleware } from '~/middlewares/role.middleware';
import {
  createTestimoni,
  getTestimoniByCourseId,
} from '~/repositories/testimoni.repo';
import { getUserRoles } from '~/repositories/user-role.repo';
import {
  getTestimoniByCourseIdRoute,
  postTestimoniRoute,
} from '~/routes/testimoni.route';
import { withDb, type WithoutDb } from './deps';
import { createAuthRouter } from './router-factory';

/** What the testimonial routes need from storage, passed in so the route tests run without a database. */
export interface TestimoniDeps {
  getUserRoles: WithoutDb<typeof getUserRoles>;
  createTestimoni: WithoutDb<typeof createTestimoni>;
  getTestimoniByCourseId: WithoutDb<typeof getTestimoniByCourseId>;
}

/** A testimonial as members see it: without its author's user id (review m7). */
function withoutAuthor<T extends { userId: string | null }>({
  userId: _userId,
  ...testimonial
}: T) {
  return testimonial;
}

const databaseDeps: TestimoniDeps = {
  getUserRoles: withDb(getUserRoles),
  createTestimoni: withDb(createTestimoni),
  getTestimoniByCourseId: withDb(getTestimoniByCourseId),
};

export function createTestimoniRouter(deps: TestimoniDeps = databaseDeps) {
  const testimoniRoute = createAuthRouter();

  testimoniRoute.post(
    postTestimoniRoute.getRoutingPath(),
    roleMiddleware(['akademik'], deps.getUserRoles),
  );
  testimoniRoute.openapi(postTestimoniRoute, async (c) => {
    const data = c.req.valid('json');
    const res = await deps.createTestimoni(data, c.var.user.id);
    return c.json(withoutAuthor(res), 200);
  });

  testimoniRoute.openapi(getTestimoniByCourseIdRoute, async (c) => {
    const { courseId } = c.req.valid('param');
    const testi = await deps.getTestimoniByCourseId(courseId);
    return c.json(testi.map(withoutAuthor), 200);
  });

  return testimoniRoute;
}

export const testimoniRoute = createTestimoniRouter();

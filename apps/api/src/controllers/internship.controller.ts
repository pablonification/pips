import postgres from 'postgres';
import { db } from '~/db/drizzle';
import { spartaWindowFor } from '~/lib/sparta-window';
import { internshipEligibilityMiddleware } from '~/middlewares/internship-eligibility.middleware';
import { roleMiddleware } from '~/middlewares/role.middleware';
import {
  createDepartment,
  createDivision,
  deleteDepartment,
  deleteDivision,
  getDepartmentsWithDivisions,
  getSubmissionById,
  getSubmissionByUserId,
  getSubmissionsList,
  updateDepartment,
  updateDivision,
  upsertSubmission,
} from '~/repositories/internship.repo';
import {
  createInternshipDepartmentRoute,
  createInternshipDivisionRoute,
  deleteInternshipDepartmentRoute,
  deleteInternshipDivisionRoute,
  getInternshipDepartmentsRoute,
  getInternshipSubmissionByIdRoute,
  getInternshipWindowRoute,
  getMyInternshipSubmissionRoute,
  listInternshipSubmissionsRoute,
  submitMyInternshipSubmissionRoute,
  updateInternshipDepartmentRoute,
  updateInternshipDivisionRoute,
  upsertMyInternshipSubmissionRoute,
} from '~/routes/internship.route';
import { withDb, type WithoutDb } from './deps';
import { createAuthRouter } from './router-factory';

const SPARTA_ADMIN_ROLES = ['peoplemanage', 'admin'] as const;

/** What a member's SPARTA routes need, passed in so the route tests run without a database. */
export interface InternshipDeps {
  getSubmissionByUserId: WithoutDb<typeof getSubmissionByUserId>;
  upsertSubmission: WithoutDb<typeof upsertSubmission>;
  /** The server's clock (tests move it). */
  now: () => Date;
}

const databaseDeps: InternshipDeps = {
  getSubmissionByUserId: withDb(getSubmissionByUserId),
  upsertSubmission: withDb(upsertSubmission),
  now: () => new Date(),
};

export function createInternshipRouter(deps: InternshipDeps = databaseDeps) {
  const internshipRouter = createAuthRouter();

  // Open to every signed-in member (outside the eligibility middleware): the app asks before showing SPARTA at all.
  internshipRouter.openapi(getInternshipWindowRoute, async (c) => {
    return c.json(spartaWindowFor(c.var.user, deps.now()), 200);
  });

  internshipRouter.openapi(getInternshipDepartmentsRoute, async (c) => {
    const departments = await getDepartmentsWithDivisions(db);
    return c.json({ departments }, 200);
  });

  internshipRouter.post(
    createInternshipDepartmentRoute.getRoutingPath(),
    roleMiddleware([...SPARTA_ADMIN_ROLES]),
  );
  internshipRouter.openapi(createInternshipDepartmentRoute, async (c) => {
    try {
      const data = c.req.valid('json');
      const department = await createDepartment(db, data);
      return c.json(department, 201);
    } catch (err) {
      if (err instanceof postgres.PostgresError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  });

  internshipRouter.put(
    updateInternshipDepartmentRoute.getRoutingPath(),
    roleMiddleware([...SPARTA_ADMIN_ROLES]),
  );
  internshipRouter.openapi(updateInternshipDepartmentRoute, async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const department = await updateDepartment(db, id, data);
    if (!department) return c.json({ error: 'Department not found' }, 404);
    return c.json(department, 200);
  });

  internshipRouter.delete(
    deleteInternshipDepartmentRoute.getRoutingPath(),
    roleMiddleware([...SPARTA_ADMIN_ROLES]),
  );
  internshipRouter.openapi(deleteInternshipDepartmentRoute, async (c) => {
    const { id } = c.req.valid('param');
    const department = await deleteDepartment(db, id);
    if (!department) return c.json({ error: 'Department not found' }, 404);
    return c.json(department, 200);
  });

  internshipRouter.post(
    createInternshipDivisionRoute.getRoutingPath(),
    roleMiddleware([...SPARTA_ADMIN_ROLES]),
  );
  internshipRouter.openapi(createInternshipDivisionRoute, async (c) => {
    try {
      const data = c.req.valid('json');
      const division = await createDivision(db, data);
      return c.json(division, 201);
    } catch (err) {
      if (err instanceof postgres.PostgresError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  });

  internshipRouter.put(
    updateInternshipDivisionRoute.getRoutingPath(),
    roleMiddleware([...SPARTA_ADMIN_ROLES]),
  );
  internshipRouter.openapi(updateInternshipDivisionRoute, async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const division = await updateDivision(db, id, data);
    if (!division) return c.json({ error: 'Division not found' }, 404);
    return c.json(division, 200);
  });

  internshipRouter.delete(
    deleteInternshipDivisionRoute.getRoutingPath(),
    roleMiddleware([...SPARTA_ADMIN_ROLES]),
  );
  internshipRouter.openapi(deleteInternshipDivisionRoute, async (c) => {
    const { id } = c.req.valid('param');
    const division = await deleteDivision(db, id);
    if (!division) return c.json({ error: 'Division not found' }, 404);
    return c.json(division, 200);
  });

  internshipRouter.use(
    getMyInternshipSubmissionRoute.getRoutingPath(),
    internshipEligibilityMiddleware,
  );
  internshipRouter.openapi(getMyInternshipSubmissionRoute, async (c) => {
    const submission = await deps.getSubmissionByUserId(c.var.user.id);
    return c.json(submission ?? null, 200);
  });

  internshipRouter.use(
    upsertMyInternshipSubmissionRoute.getRoutingPath(),
    internshipEligibilityMiddleware,
  );
  internshipRouter.openapi(upsertMyInternshipSubmissionRoute, async (c) => {
    const data = c.req.valid('json');
    if (spartaWindowFor(c.var.user, deps.now()).status !== 'open') {
      return c.json({ error: 'SPARTA is not taking applications now' }, 403);
    }
    try {
      const submission = await deps.upsertSubmission(
        {
          id: c.var.user.id,
          nim: c.var.user.nim,
          fullName: c.var.user.fullName,
          major: c.var.user.major,
        },
        data,
        false,
      );
      return c.json(submission, 200);
    } catch (err) {
      if (err instanceof Error && err.message === 'LOCKED') {
        return c.json({ error: 'Submission is already locked' }, 409);
      }
      if (err instanceof postgres.PostgresError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  });

  internshipRouter.use(
    submitMyInternshipSubmissionRoute.getRoutingPath(),
    internshipEligibilityMiddleware,
  );
  internshipRouter.openapi(submitMyInternshipSubmissionRoute, async (c) => {
    const data = c.req.valid('json');
    if (spartaWindowFor(c.var.user, deps.now()).status !== 'open') {
      return c.json({ error: 'SPARTA is not taking applications now' }, 403);
    }
    try {
      const submission = await deps.upsertSubmission(
        {
          id: c.var.user.id,
          nim: c.var.user.nim,
          fullName: c.var.user.fullName,
          major: c.var.user.major,
        },
        data,
        true,
      );
      return c.json(submission, 200);
    } catch (err) {
      if (err instanceof Error && err.message === 'LOCKED') {
        return c.json({ error: 'Submission is already locked' }, 409);
      }
      if (err instanceof postgres.PostgresError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  });

  internshipRouter.get(
    listInternshipSubmissionsRoute.getRoutingPath(),
    roleMiddleware([...SPARTA_ADMIN_ROLES]),
  );
  internshipRouter.openapi(listInternshipSubmissionsRoute, async (c) => {
    const query = c.req.valid('query');
    const submissions = await getSubmissionsList(db, query);
    return c.json({ submissions }, 200);
  });

  internshipRouter.get(
    getInternshipSubmissionByIdRoute.getRoutingPath(),
    roleMiddleware([...SPARTA_ADMIN_ROLES]),
  );
  internshipRouter.openapi(getInternshipSubmissionByIdRoute, async (c) => {
    const { id } = c.req.valid('param');
    const submission = await getSubmissionById(db, id);
    if (!submission) return c.json({ error: 'Submission not found' }, 404);
    return c.json(submission, 200);
  });

  return internshipRouter;
}

export const internshipRouter = createInternshipRouter();

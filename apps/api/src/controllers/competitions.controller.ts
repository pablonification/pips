import { databaseError } from '~/lib/database-error';
import postgres from 'postgres';
import { competitionCategories } from '~/db/schema';
import { forRoles } from '~/middlewares/role.middleware';
import {
  createCompetition,
  deleteCompetition,
  getCompetitionById,
  getCompetitionsList,
  updateCompetition,
} from '~/repositories/competitions.repo';
import { getUserRoles } from '~/repositories/user-role.repo';
import {
  createCompetitionRoute,
  deleteCompetitionRoute,
  getCompetitionCategoriesRoute,
  getCompetitionListRoute,
  updateCompetitionRoute,
} from '~/routes/competitions.route';
import { withDb, type WithoutDb } from './deps';
import { createAuthRouter } from './router-factory';

/** What the competition routes need from storage, passed in so the route tests run without a database. */
export interface CompetitionsDeps {
  getUserRoles: WithoutDb<typeof getUserRoles>;
  createCompetition: WithoutDb<typeof createCompetition>;
  updateCompetition: WithoutDb<typeof updateCompetition>;
  getCompetitionById: WithoutDb<typeof getCompetitionById>;
  getCompetitionsList: WithoutDb<typeof getCompetitionsList>;
  deleteCompetition: WithoutDb<typeof deleteCompetition>;
}

const databaseDeps: CompetitionsDeps = {
  getUserRoles: withDb(getUserRoles),
  createCompetition: withDb(createCompetition),
  updateCompetition: withDb(updateCompetition),
  getCompetitionById: withDb(getCompetitionById),
  getCompetitionsList: withDb(getCompetitionsList),
  deleteCompetition: withDb(deleteCompetition),
};

export function createCompetitionsRouter(
  deps: CompetitionsDeps = databaseDeps,
) {
  const competitionsRouter = createAuthRouter();

  competitionsRouter.openapi(getCompetitionCategoriesRoute, async (c) => {
    c.header('Cache-Control', 'public, max-age=3600');

    return c.json([...competitionCategories], 200);
  });

  competitionsRouter.openapi(
    forRoles(createCompetitionRoute, ['cnc'], deps.getUserRoles),
    async (c) => {
      try {
        const data = c.req.valid('json');
        const competition = await deps.createCompetition(data, c.var.user.id);
        return c.json(competition, 201);
      } catch (err) {
        if (err instanceof postgres.PostgresError) {
          return c.json(databaseError(err), 400);
        }
        throw err;
      }
    },
  );

  competitionsRouter.openapi(
    forRoles(updateCompetitionRoute, ['cnc'], deps.getUserRoles),
    async (c) => {
      try {
        const { id } = c.req.valid('param');
        const data = c.req.valid('json');
        // Nothing to change: Drizzle's set({}) would throw and answer 500.
        if (Object.keys(data).length === 0)
          return c.json({ error: 'Nothing to update' }, 400);

        const existingCompetition = await deps.getCompetitionById(id);
        if (!existingCompetition)
          return c.json({ error: 'Competition not found' }, 404);

        const competition = await deps.updateCompetition(
          id,
          data,
          c.var.user.id,
        );
        return c.json(competition, 200);
      } catch (err) {
        if (err instanceof postgres.PostgresError) {
          return c.json(databaseError(err), 400);
        }
        throw err;
      }
    },
  );

  competitionsRouter.openapi(getCompetitionListRoute, async (c) => {
    const query = c.req.valid('query');
    const competitions = await deps.getCompetitionsList(query);
    return c.json(
      {
        competitions,
      },
      200,
    );
  });

  competitionsRouter.openapi(
    forRoles(deleteCompetitionRoute, ['cnc'], deps.getUserRoles),
    async (c) => {
      const { competitionId } = c.req.valid('param');
      const competition = await deps.deleteCompetition(competitionId);
      if (!competition) {
        return c.json({ error: 'Competition not found' }, 404);
      }
      return c.json({ ...competition }, 200);
    },
  );

  return competitionsRouter;
}

export const competitionsRouter = createCompetitionsRouter();

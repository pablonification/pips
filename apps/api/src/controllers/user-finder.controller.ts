import postgres from 'postgres';
import { toNimFinderResult } from '~/lib/nim-finder';
import { getUserByNimOrName } from '~/repositories/user-finder.repo';
import { getUserRoute } from '~/routes/user-finder.route';
import { withDb, type WithoutDb } from './deps';
import { createAuthRouter } from './router-factory';

export interface UserFinderDeps {
  getUserByNimOrName: WithoutDb<typeof getUserByNimOrName>;
}

export function createUserFinderRouter(
  deps: UserFinderDeps = { getUserByNimOrName: withDb(getUserByNimOrName) },
) {
  const userFinderRouter = createAuthRouter();

  userFinderRouter.openapi(getUserRoute, async (c) => {
    const q = c.req.valid('query');

    try {
      const users = await deps.getUserByNimOrName(q);
      return c.json(users.map(toNimFinderResult), 200);
    } catch (error) {
      if (error instanceof postgres.PostgresError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  });

  return userFinderRouter;
}

export const userFinderRouter = createUserFinderRouter();

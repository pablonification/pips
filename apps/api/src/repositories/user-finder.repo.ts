import { z } from 'zod';
import { Database } from '~/db/drizzle';
import { users } from '~/db/schema';
import {
  NIM_FINDER_COLUMNS,
  NIM_FINDER_LIMIT,
  nimFinderSearch,
} from '~/lib/nim-finder';
import { NimFinderQuerySchema } from '~/types/user-finder.types';

/** The query NIM Finder runs: only the four public columns, the search taken literally, at most NIM_FINDER_LIMIT. */
export function nimFinderQuery(
  db: Database,
  q: z.infer<typeof NimFinderQuerySchema>,
) {
  const { where, orderBy } = nimFinderSearch(q.search);
  return db
    .select(NIM_FINDER_COLUMNS)
    .from(users)
    .where(where)
    .orderBy(...orderBy)
    .limit(NIM_FINDER_LIMIT);
}

export async function getUserByNimOrName(
  db: Database,
  q: z.infer<typeof NimFinderQuerySchema>,
) {
  return await nimFinderQuery(db, q);
}

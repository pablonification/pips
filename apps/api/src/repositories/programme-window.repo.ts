import { asc, eq } from 'drizzle-orm';
import { Database } from '~/db/drizzle';
import { programmeWindows } from '~/db/schema';

/** Every switched-on window; which are open for whom is decided on the server's clock (`isWindowOpenFor`). */
export async function getActiveProgrammeWindows(db: Database) {
  return await db
    .select()
    .from(programmeWindows)
    .where(eq(programmeWindows.isActive, true))
    .orderBy(asc(programmeWindows.opensAt));
}

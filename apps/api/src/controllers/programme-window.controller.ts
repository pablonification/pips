import { isValidWindowRoute, isWindowOpenFor } from '~/lib/programme-window';
import { getActiveProgrammeWindows } from '~/repositories/programme-window.repo';
import { listProgrammeWindowsRoute } from '~/routes/programme-window.route';
import { withDb, type WithoutDb } from './deps';
import { createAuthRouter } from './router-factory';

export interface ProgrammeWindowDeps {
  getActiveProgrammeWindows: WithoutDb<typeof getActiveProgrammeWindows>;
  /** The server's clock (tests move it). */
  now: () => Date;
}

export function createProgrammeWindowRouter(
  deps: ProgrammeWindowDeps = {
    getActiveProgrammeWindows: withDb(getActiveProgrammeWindows),
    now: () => new Date(),
  },
) {
  const router = createAuthRouter();

  router.openapi(listProgrammeWindowsRoute, async (c) => {
    const now = deps.now();
    const windows = (await deps.getActiveProgrammeWindows())
      .filter(
        (w) =>
          isWindowOpenFor(w, c.var.user, now) && isValidWindowRoute(w.route),
      )
      .map((w) => ({
        id: w.id,
        slug: w.slug,
        kind: w.kind,
        label: w.label,
        route: w.route,
        opensAt: w.opensAt,
        closesAt: w.closesAt,
      }));
    return c.json({ windows }, 200);
  });

  return router;
}

export const programmeWindowRouter = createProgrammeWindowRouter();

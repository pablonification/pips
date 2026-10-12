import type { UserWithRoles } from '~/api/generated';

export type Role = UserWithRoles['roles'][number];

/**
 * What each role may do, mirroring the server's checks (SPEC "Kelola and role-aware UI"). Every pengurus action
 * renders through `can()`; members never see an action they can't complete. `tests/capabilities.test.ts` reads
 * the API's source and fails if a row here drifts from it. Add rows in their own commit (WORKER-RULES).
 */
export const CAPABILITY_ROLES = {
  /** Add a competition to Info Lomba: `competitions.controller.ts`, roleMiddleware(['cnc']). */
  createCompetition: ['cnc'],
  /** Add an Akademik event (a course is required): `calendar.controller.ts`. */
  createAkademikEvent: ['akademik'],
  /** Add a Himpunan event: `calendar.controller.ts`. */
  createHimpunanEvent: ['ring1'],
  /** Add a testimonial to Testi Matkul (API only today): `testimoni.controller.ts`. */
  createTestimonial: ['akademik'],
  /** Send a push to everyone (API only today): `push.controller.ts`. */
  broadcastPush: ['ring1'],
  /** Live Counting & Rekap Form: `form.controller.ts`, FORM_ADMIN_ROLES. */
  liveCounting: ['admin'],
  /** Data SPARTA Magang: `internship.controller.ts`, SPARTA_ADMIN_ROLES. */
  spartaData: ['admin', 'peoplemanage'],
  /** Answer Curhat rooms as Welfare: `curhat.controller.ts`. */
  respondCurhat: ['curhatadmin'],
  /** Remove other members' announcements and comments: `lib/authorization.ts`, CONTENT_MODERATOR_ROLES. */
  moderateContent: ['admin'],
  /** Change the shared course catalogue (API only today): `lib/authorization.ts`, COURSE_CATALOG_MANAGER_ROLES. */
  editCourseCatalog: ['akademik', 'admin'],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof CAPABILITY_ROLES;

type WithRoles = { roles?: readonly string[] | null } | null | undefined;

/** Whether `user` holds a role that the server accepts for `capability`. */
export function can(user: WithRoles, capability: Capability): boolean {
  const roles = user?.roles ?? [];
  return (CAPABILITY_ROLES[capability] as readonly string[]).some((role) =>
    roles.includes(role),
  );
}

/** Either kind of calendar event (the Kalender's "Tambah acara"). */
export function canCreateEvent(user: WithRoles): boolean {
  return can(user, 'createAkademikEvent') || can(user, 'createHimpunanEvent');
}

/**
 * Posting an announcement needs no role, except in a category with a `rolesAllowed` list: then one of the
 * member's roles must be in it. As the composer's `GET /category/info` filters: only `null` is open to every
 * member, and an empty list is open to nobody.
 */
export function canPostInCategory(
  user: WithRoles,
  category: { rolesAllowed?: readonly string[] | null },
): boolean {
  const allowed = category.rolesAllowed;
  if (allowed === null || allowed === undefined) return true;
  const roles = user?.roles ?? [];
  return allowed.some((role) => roles.includes(role));
}

/** Deleting an announcement or comment: its author, or a moderator. Re-announcing and editing stay author-only. */
export function canDeleteContent(
  user: ({ id: string } & NonNullable<WithRoles>) | null | undefined,
  authorId: string,
): boolean {
  return !!user && (user.id === authorId || can(user, 'moderateContent'));
}

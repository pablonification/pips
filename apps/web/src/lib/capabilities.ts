import type { UserWithRoles } from '~/api/generated';

type Role = UserWithRoles['roles'][number];

/**
 * Every role the API knows: a pengurus is a member who holds at least one (`apps/api/src/db/roles-group.ts`, the
 * route table's PENGURUS). A member's roles come only from that list, so holding any role is being a pengurus.
 */
export const ANY_ROLE = 'any role';

/**
 * What each role may do, mirroring the server's checks. Every pengurus action
 * renders through `can()`; members never see an action they can't complete. `tests/capabilities.test.ts` reads
 * the API's source and fails if a row here drifts from it.
 */
export const CAPABILITY_ROLES = {
  /** Add a competition to Info Lomba: `competitions.controller.ts`, forRoles(…, ['cnc']). */
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
  /** Answer Curhat rooms as Welfare: `curhat.controller.ts`. */
  respondCurhat: ['curhatadmin'],
  /** Remove other members' announcements and comments: `lib/authorization.ts`, CONTENT_MODERATOR_ROLES. */
  moderateContent: ['admin'],
  /** Change the shared course catalogue (API only today): `lib/authorization.ts`, COURSE_CATALOG_MANAGER_ROLES. */
  editCourseCatalog: ['akademik', 'admin'],
  /** Change or delete a competition in Info Lomba: `competitions.controller.ts`, the same forRoles(…, ['cnc']). */
  manageCompetition: ['cnc'],
  /** Kelola › Form, the builder: any pengurus (`route-access.ts`, POST /api/form). The form's own access decides the rest. */
  buildForms: ANY_ROLE,
  /** "Semua form" in Kelola › Form, and editing any form: `form-manage.controller.ts`, admin. */
  manageAllForms: ['admin'],
} as const satisfies Record<string, readonly Role[] | typeof ANY_ROLE>;

export type Capability = keyof typeof CAPABILITY_ROLES;

type WithRoles = { roles?: readonly string[] | null } | null | undefined;

/** Whether `user` holds a role that the server accepts for `capability`. */
export function can(user: WithRoles, capability: Capability): boolean {
  const roles = user?.roles ?? [];
  const need = CAPABILITY_ROLES[capability];
  if (need === ANY_ROLE) return roles.length > 0;
  return (need as readonly string[]).some((role) => roles.includes(role));
}

/** Either kind of calendar event (the Kalender's "Tambah acara"). */
export function canCreateEvent(user: WithRoles): boolean {
  return can(user, 'createAkademikEvent') || can(user, 'createHimpunanEvent');
}

/* Calendar events by category, as `calendar.controller.ts` checks adding, changing and deleting them. */

export type EventCategory = 'akademik' | 'himpunan';

/** The categories `user` may add, Akademik first (the add-event dialog's choice). */
export function eventCategoriesFor(user: WithRoles): EventCategory[] {
  return [
    ...(can(user, 'createAkademikEvent') ? (['akademik'] as const) : []),
    ...(can(user, 'createHimpunanEvent') ? (['himpunan'] as const) : []),
  ];
}

/** Changing or deleting an event: Akademik ones need `akademik`; every other category needs `ring1`, as the server. */
export function canManageEvent(user: WithRoles, category: string): boolean {
  return can(
    user,
    category === 'akademik' ? 'createAkademikEvent' : 'createHimpunanEvent',
  );
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

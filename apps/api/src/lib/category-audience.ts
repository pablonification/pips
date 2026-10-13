/**
 * Who may post in a category, as `getInfoCategoryList` (category.repo.ts) lists them: `rolesAllowed` null means
 * everyone; otherwise the poster needs one of those roles, so an empty list admits nobody.
 */
export function canPostInCategory(
  roles: readonly string[],
  rolesAllowed: readonly string[] | null | undefined,
): boolean {
  if (rolesAllowed === null || rolesAllowed === undefined) return true;
  return rolesAllowed.some((role) => roles.includes(role));
}

export type CategoryRefusal =
  | { ok: true }
  | { ok: false; reason: 'unknown'; categoryIds: string[] }
  | { ok: false; reason: 'forbidden'; categoryIds: string[] };

/** Checks every chosen category: one that doesn't exist, or one closed to the poster, refuses the post. */
export function checkPostCategories(
  roles: readonly string[],
  chosen: readonly string[],
  categories: ReadonlyArray<{
    id: string;
    rolesAllowed: readonly string[] | null;
  }>,
): CategoryRefusal {
  const byId = new Map(categories.map((c) => [c.id, c.rolesAllowed]));
  const unknown = chosen.filter((id) => !byId.has(id));
  if (unknown.length)
    return { ok: false, reason: 'unknown', categoryIds: unknown };
  const forbidden = chosen.filter(
    (id) => !canPostInCategory(roles, byId.get(id)),
  );
  if (forbidden.length)
    return { ok: false, reason: 'forbidden', categoryIds: forbidden };
  return { ok: true };
}

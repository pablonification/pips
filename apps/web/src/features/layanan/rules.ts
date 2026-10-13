import type { ServiceId } from '~/lib/services';

/*
 * Layanan's badges (garis/screens-more.js `svcBadge`), unit-tested in tests/layanan-rules.test.ts. Groups, order,
 * Kelola per role and expired entries come from the registry's `servicesByGroup`.
 */

/** Curhat Yuk!'s count: unread messages summed over your rooms. */
export function curhatUnreadTotal(
  rooms: ReadonlyArray<{ unreadCount: number }> | undefined,
): number {
  return (rooms ?? []).reduce((n, r) => n + Math.max(0, r.unreadCount), 0);
}

/** Form's tag: forms open for you that you haven't answered (`status: 'open'`). */
export function openFormsCount(
  forms: ReadonlyArray<{ status: string }> | undefined,
): number {
  return (forms ?? []).filter((f) => f.status === 'open').length;
}

export type ServiceBadge =
  { kind: 'count'; value: number } | { kind: 'tag'; value: number };

/** The badge a row shows, if any: none while its data is loading or failed (undefined), none at 0. */
export function serviceBadge(
  id: ServiceId,
  data: { unread?: number; openForms?: number },
): ServiceBadge | null {
  if (id === 'curhat' && data.unread)
    return { kind: 'count', value: data.unread };
  if (id === 'form' && data.openForms)
    return { kind: 'tag', value: data.openForms };
  return null;
}

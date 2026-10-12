/**
 * The one window rule for everything that opens and closes on the server's clock: forms (`form-status.ts`),
 * Magang SPARTA (`sparta-window.ts`) and the programme windows (`GET /programme-windows`).
 *
 * A window is open from `opensAt` (inclusive; null means already open) until `closesAt` (exclusive; null means
 * until it's switched off), while it is active.
 */
export interface TimeWindow {
  opensAt: Date | string | null;
  closesAt: Date | string | null;
  isActive?: boolean;
}

export type WindowStatus = 'not_opened' | 'open' | 'closed';

const time = (value: Date | string | number) => new Date(value).getTime();

export function windowStatus(
  window: TimeWindow,
  now: Date | number = Date.now(),
): WindowStatus {
  if (window.isActive === false) return 'closed';
  if (window.closesAt !== null && time(now) >= time(window.closesAt)) {
    return 'closed';
  }
  if (window.opensAt !== null && time(now) < time(window.opensAt)) {
    return 'not_opened';
  }
  return 'open';
}

/** Who a window is for: everyone when both lists are empty, otherwise a listed angkatan or a listed NIM. */
export interface WindowAudience {
  eligibleAngkatan: readonly number[];
  eligibleNims: readonly string[];
}

export function isEligibleFor(
  audience: WindowAudience,
  user: { angkatan: number; nim: string },
): boolean {
  if (
    audience.eligibleAngkatan.length === 0 &&
    audience.eligibleNims.length === 0
  ) {
    return true;
  }
  return (
    audience.eligibleAngkatan.includes(user.angkatan) ||
    audience.eligibleNims.includes(user.nim)
  );
}

/** A programme window is shown to a member when it's open now and they're eligible. */
export function isWindowOpenFor(
  window: TimeWindow & WindowAudience,
  user: { angkatan: number; nim: string },
  now: Date | number = Date.now(),
): boolean {
  return windowStatus(window, now) === 'open' && isEligibleFor(window, user);
}

/** Where a window leads: an app path (`/layanan/sparta`) or an `https://` address. */
export function isValidWindowRoute(route: string): boolean {
  if (route.startsWith('/')) {
    return !route.startsWith('//') && !route.includes('\\');
  }
  try {
    const url = new URL(route);
    return url.protocol === 'https:' && url.hostname !== '';
  } catch {
    return false;
  }
}

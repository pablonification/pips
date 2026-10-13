/** How long after the last push an announcement's author may send it again (Umumkan ulang), unless the env says otherwise. */
export const DEFAULT_RENOTIFY_HOURS = 3;

const HOUR_MS = 60 * 60 * 1000;

/** When Umumkan ulang unlocks: `hours` after the last push. */
export function renotifyAvailableAt(
  lastNotifiedAt: Date | string,
  hours: number = DEFAULT_RENOTIFY_HOURS,
): Date {
  return new Date(new Date(lastNotifiedAt).getTime() + hours * HOUR_MS);
}

/**
 * Whether Umumkan ulang is open: once `hours` have passed since the last push, to the millisecond. (It used to
 * count whole hours and need more than three of them, so it stayed locked until four hours had passed.)
 */
export function canRenotify(
  lastNotifiedAt: Date | string,
  now: Date | number = Date.now(),
  hours: number = DEFAULT_RENOTIFY_HOURS,
): boolean {
  return (
    new Date(now).getTime() >=
    renotifyAvailableAt(lastNotifiedAt, hours).getTime()
  );
}

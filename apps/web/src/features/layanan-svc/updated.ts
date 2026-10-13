import { fill } from '~/copy/fill';
import { layananSvc as copy } from '~/copy/layanan-svc';
import { dayDiff, dShort, hm } from '~/lib/dates';

/**
 * When the data under the offline banner was last updated: the time ("09.00") when it was today in WIB, else the
 * day and time ("Sen 12 Okt, 09.00"). Ding Dong's list is kept on the device for up to 7 days, and a time alone
 * read as this morning (P2-B review, finding 2).
 */
export function offlineUpdatedAt(at: number, now: number): string {
  return dayDiff(at, now) === 0
    ? hm(at)
    : fill(copy.hariJam, { tanggal: dShort(at), jam: hm(at) });
}

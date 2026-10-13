/**
 * P3-B: why a management write failed, in the two ways the member is told. A 401 or 403 is "no access"
 * (`roleMiddleware` answers 401 for a missing role), never "signed out": only P0-B's session check signs a member
 * out. Everything else (offline, a 404, a 5xx, Google Calendar refusing) is "not saved, try again".
 */
import { ApiError } from '~/api/generated';
import { kelolaTulis as t } from '~/copy/kelola-tulis';

export type WriteFailure = 'tanpaAkses' | 'gagal';

export function writeFailure(error: unknown): WriteFailure {
  return error instanceof ApiError &&
    (error.status === 401 || error.status === 403)
    ? 'tanpaAkses'
    : 'gagal';
}

/** The error toast's text: never the API's own words. */
export function writeFailureMessage(error: unknown): string {
  return t[writeFailure(error)];
}

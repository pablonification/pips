/*
 * Sign-in's error mapping (unit-tested, tests/masuk-rules.test.ts). Never raw API text, never alert().
 */

/** What the screen says after a failed sign-in; null says nothing (the member closed Google's popup). */
export type SignInProblem = 'bukan-anggota' | 'gagal' | 'popup-diblokir';

/** `POST /api/auth/login/accesstoken`'s failure: 401 is not a member (or not an std account); anything else retries. */
export function signInProblem(error: unknown): SignInProblem {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: unknown }).status)
      : null;
  return status === 401 ? 'bukan-anggota' : 'gagal';
}

/** Google's popup failing before a token: closed by the member says nothing; blocked says so. */
export function popupProblem(type: string | undefined): SignInProblem | null {
  if (type === 'popup_closed') return null;
  if (type === 'popup_failed_to_open') return 'popup-diblokir';
  return 'gagal';
}

/**
 * Push notifications on this device (P1-C), for every screen that shows or changes them:
 *
 * - `usePushState()`: `{ status, loading }`. `status` is one of `'aktif' | 'belum' | 'diblokir' | 'perlu-pasang' |
 *   'tidak-didukung'` (`~/lib/push-state`), or null while it's first read. Shared by every caller and read again
 *   after the prompt and when the member comes back to the tab.
 * - `openPushPrompt()`: opens "Nyalakan notifikasi?" and resolves with how it ended (`'aktif'`, `'nanti'`,
 *   `'diblokir'`, `'gagal'`, `'tutup'`). Call it only from a tap: the prompt's Nyalakan is the one place that asks
 *   the browser for permission.
 * - `<PushPrompt />`: mounted once at the root (routes/__root.tsx).
 * - `pushStatusWords`: the Profil row's words and tone for a status.
 *
 * In journeys, the harness's `push` option sets the device (`'off'`, `'on'`, `'blocked'`; e2e/support/push.ts).
 */
export { PushPrompt, toastPushResult } from './PushPrompt';
export {
  openPushPrompt,
  refreshPushState,
  turnPushOn,
  type PushPromptResult,
} from './push-store';
export { pushStatusWords, usePushState } from './usePushState';
export type { PushStatus } from '~/lib/push-state';

import { enablePush, readPushFacts } from '~/lib/push';
import { pushStatus, type PushStatus } from '~/lib/push-state';

/*
 * One store for this device's push state and the prompt, shared by every screen that shows them (Profil, Notifikasi,
 * Beranda's row, search's action, first run). Outside React so `openPushPrompt()` can be called from anywhere.
 */

/** How the prompt ended. */
export type PushPromptResult =
  /** Notifications are on. */
  | 'aktif'
  /** Nanti saja, or the browser's own permission prompt dismissed. */
  | 'nanti'
  /** Permission denied. */
  | 'diblokir'
  /** Permission granted but subscribing or registering failed. */
  | 'gagal'
  /** Closed with Tutup or Escape. */
  | 'tutup';

interface State {
  /** null while it's being read for the first time. */
  status: PushStatus | null;
  promptOpen: boolean;
  /** Nyalakan is running. */
  pending: boolean;
}

let state: State = { status: null, promptOpen: false, pending: false };
const listeners = new Set<() => void>();
let resolvePrompt: ((r: PushPromptResult) => void) | null = null;
let reading: Promise<PushStatus> | null = null;

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const pushStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** Reads permission and subscription again (after the prompt, or when the member comes back from site settings). */
export function refreshPushState(): Promise<PushStatus> {
  reading ??= readPushFacts()
    .then(pushStatus)
    .then((status) => {
      set({ status });
      return status;
    })
    .finally(() => {
      reading = null;
    });
  return reading;
}

/**
 * Opens "Nyalakan notifikasi?" (a sheet on phones and tablets, a small dialog on desktop). Call it only from a tap
 * (SPEC story 104: permission is asked only after the member chooses to). Resolves with how it ended. When this
 * device is already on, it resolves at once with `'aktif'` and opens nothing.
 */
export async function openPushPrompt(): Promise<PushPromptResult> {
  const status = state.status ?? (await refreshPushState());
  if (status === 'aktif') return 'aktif';
  resolvePrompt?.('tutup');
  set({ promptOpen: true, pending: false });
  return new Promise((resolve) => {
    resolvePrompt = resolve;
  });
}

/** Closes the prompt with this result (the prompt component calls it). */
export function settlePushPrompt(result: PushPromptResult) {
  set({ promptOpen: false, pending: false });
  const r = resolvePrompt;
  resolvePrompt = null;
  r?.(result);
}

/**
 * Nyalakan: asks for permission, subscribes and registers. Returns how it ended; the caller shows the toast.
 * Also used by the error toast's Coba lagi, when permission is already granted, so nothing is asked again.
 */
export async function turnPushOn(): Promise<
  Exclude<PushPromptResult, 'tutup'>
> {
  set({ pending: true });
  try {
    const outcome = await enablePush();
    return outcome === 'belum' ? 'nanti' : outcome;
  } catch {
    return 'gagal';
  } finally {
    set({ pending: false });
    await refreshPushState();
  }
}

let watching = false;
/** The member may change the permission in the browser's settings and come back: read it again then. */
export function watchPushState() {
  if (watching || typeof document === 'undefined') return;
  watching = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshPushState();
  });
}

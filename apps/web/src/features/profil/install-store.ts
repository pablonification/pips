import { currentPlatform, type Platform } from '~/lib/platform';

/*
 * Pasang PIPS! (SPEC story 8): Android Chrome's saved `beforeinstallprompt`, and which way of installing fits this
 * device. Opened from Profil, Notifikasi (an iPhone outside the installed app) and first run.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** How this device installs PIPS!. */
export type InstallWay =
  /** Already running as the installed app. */
  | 'terpasang'
  /** Android Chrome offered its install prompt: one button. */
  | 'prompt'
  /** iPhone or iPad: Bagikan → Tambahkan ke Layar Utama. */
  | 'iphone'
  /** LINE's in-app browser: open PIPS! in Chrome or Safari first. */
  | 'line'
  /** Android Chrome without a saved prompt: its menu. */
  | 'android'
  /** Anything else: the browser's own install control. */
  | 'lainnya';

export function installWay(platform: Platform, hasPrompt: boolean): InstallWay {
  if (platform.standalone) return 'terpasang';
  if (platform.line) return 'line';
  if (platform.ios) return 'iphone';
  if (hasPrompt) return 'prompt';
  if (platform.androidChrome) return 'android';
  return 'lainnya';
}

interface State {
  open: boolean;
  deferred: InstallPromptEvent | null;
  installed: boolean;
}
let state: State = { open: false, deferred: null, installed: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const installStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

if (typeof window !== 'undefined') {
  // Chrome fires this once it considers PIPS! installable; keep it for the Pasang PIPS! button instead of its
  // own mini bar (SPEC story 8: the Android prompt is offered from Profil and first run).
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    set({ deferred: e as InstallPromptEvent });
  });
  window.addEventListener('appinstalled', () =>
    set({ deferred: null, installed: true }),
  );
}

export function currentInstallWay(): InstallWay {
  const platform = currentPlatform();
  if (state.installed) return 'terpasang';
  return installWay(platform, state.deferred !== null);
}

export function openInstallSheet() {
  set({ open: true });
}

export function closeInstallSheet() {
  set({ open: false });
}

/** Android Chrome's own install dialog. True when the member accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = state.deferred;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  // A prompt can be used only once.
  set({ deferred: null, installed: outcome === 'accepted' });
  return outcome === 'accepted';
}

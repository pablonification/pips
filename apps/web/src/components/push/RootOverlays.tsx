import { lazy, Suspense, useState, useSyncExternalStore } from 'react';
import { installStore } from '~/features/profil/install-store';
import { pushStore } from './push-store';

/*
 * The app-wide overlays opened from anywhere (P1-C): "Nyalakan notifikasi?" and Pasang PIPS!. Each loads on its
 * first opening, not with the page: mounted eagerly at the root they put the dialog library on every route,
 * sign-in included (about 27 KiB gzip). Once open they stay mounted, so closing animates and returns focus.
 */
const PushPrompt = lazy(() =>
  import('./PushPrompt').then((m) => ({ default: m.PushPrompt })),
);
const InstallSheet = lazy(() =>
  import('~/features/profil/InstallSheet').then((m) => ({
    default: m.InstallSheet,
  })),
);

export function RootOverlays() {
  const push = useSyncExternalStore(pushStore.subscribe, pushStore.get);
  const install = useSyncExternalStore(
    installStore.subscribe,
    installStore.get,
  );
  const [pushUsed, setPushUsed] = useState(false);
  const [installUsed, setInstallUsed] = useState(false);
  if (push.promptOpen && !pushUsed) setPushUsed(true);
  if (install.open && !installUsed) setInstallUsed(true);
  return (
    <Suspense fallback={null}>
      {pushUsed || push.promptOpen ? <PushPrompt /> : null}
      {installUsed || install.open ? <InstallSheet /> : null}
    </Suspense>
  );
}

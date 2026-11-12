import { startMonitoring } from './instrument';

import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { registerSW } from 'virtual:pwa-register';
import { queryClient } from './api/client';
import { refetchFailed } from './api/reconnect';
import { RootErrorFallback } from './components/error-fallback';
import { reloadOnPreloadError } from './lib/preload-recovery';
import { runWhenSettled } from './lib/sw-register';
import { createUpdateGate, holdsText } from './lib/update-gate';
import './index.css';
// Features register with the shell at start, so it imports no feature code: Testi Matkul titles its pages from
// the URL (src/lib/shell/routes.ts), and Pengumuman counts its unread posts for the navigation badge
// (src/components/shell/nav-badges.ts).
import './features/testi/shell';
import './features/pengumuman/shell';

// Import the generated route tree
import { router } from './router';

// A page's code that can't load (its file gone after a deploy) reloads the page once, onto the new build.
reloadOnPreloadError();

// Back online, pages that failed while offline load by themselves (src/api/reconnect.ts).
window.addEventListener('online', () => void refetchFailed(queryClient));

// A new version reloads the page, but never over text being typed or a send in flight: then it waits for the next
// page (src/lib/update-gate.ts).
const update = createUpdateGate({
  typing: () =>
    holdsText(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input, textarea',
      ),
    ),
  sending: () => queryClient.isMutating() > 0,
  reload: () => window.location.reload(),
});
router.subscribe('onResolved', (e) => {
  if (e.pathChanged) update.navigated();
});

// The service worker registers once the page has loaded, its first data has arrived and the browser is idle
// (src/lib/sw-register.ts): the first paint never waits for it.
window.addEventListener(
  'load',
  () =>
    runWhenSettled(
      {
        isFetching: () => queryClient.isFetching(),
        subscribe: (listener) =>
          queryClient.getQueryCache().subscribe(listener),
      },
      () =>
        void registerSW({
          immediate: true,
          onNeedReload: () => update.newVersion(),
        }),
      {
        setTimeout: (cb, ms) => window.setTimeout(cb, ms),
        clearTimeout: (id) => window.clearTimeout(id as number),
        idle: (cb) =>
          typeof window.requestIdleCallback === 'function'
            ? requestIdleCallback(() => cb())
            : window.setTimeout(cb, 1),
      },
    ),
  { once: true },
);

// Render the app
const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary
        fallbackRender={({ error }) => <RootErrorFallback error={error} />}
      >
        <RouterProvider router={router} />
      </ErrorBoundary>
    </StrictMode>,
  );
}

startMonitoring();

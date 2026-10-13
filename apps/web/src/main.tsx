import { startMonitoring } from './instrument';

import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { registerSW } from 'virtual:pwa-register';
import { queryClient } from './api/client';
import { RootErrorFallback } from './components/error-fallback';
import { runWhenSettled } from './lib/sw-register';
import './index.css';
// Features register with the shell at start, so it imports no feature code: Testi Matkul titles its pages from
// the URL (src/lib/shell/routes.ts), and Pengumuman counts its unread posts for the navigation badge
// (src/components/shell/nav-badges.ts).
import './features/testi/shell';
import './features/pengumuman/shell';

// Import the generated route tree
import { router } from './router';

// The service worker (automatic updates reload the page) registers once the page has loaded, its first data has
// arrived and the browser is idle (src/lib/sw-register.ts): the first paint never waits for it.
window.addEventListener(
  'load',
  () =>
    runWhenSettled(
      {
        isFetching: () => queryClient.isFetching(),
        subscribe: (listener) =>
          queryClient.getQueryCache().subscribe(listener),
      },
      () => void registerSW({ immediate: true }),
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

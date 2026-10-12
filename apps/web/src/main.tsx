import { startMonitoring } from './instrument';

import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { registerSW } from 'virtual:pwa-register';
import { RootErrorFallback } from './components/error-fallback';
import './index.css';

// Import the generated route tree
import { router } from './router';

// register service worker to enable automatic updates reload
registerSW({ immediate: true });

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

import { createRouter } from '@tanstack/react-router';
import { RouteErrorFallback } from './components/error-fallback';
import { routeTree } from './routeTree.gen';

// Create a new router instance
export const router = createRouter({
  routeTree,
  // Replaces the <ScrollRestoration getKey> component, which router 1.170 deprecates and no longer configures.
  scrollRestoration: true,
  getScrollRestorationKey: (location) => location.pathname,
  // Every route gets its own error boundary; the root route has the app-wide one (Muat ulang, Ke Beranda).
  defaultErrorComponent: RouteErrorFallback,
  // Hovering or touching a link starts loading its route's code and data; the query cache decides freshness.
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

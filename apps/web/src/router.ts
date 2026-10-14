import { createRouter } from '@tanstack/react-router';
import { NotFoundPage, RouteErrorFallback } from './components/error-fallback';
import { routeTree } from './routeTree.gen';

// Create a new router instance
export const router = createRouter({
  routeTree,
  // Replaces the <ScrollRestoration getKey> component, which router 1.170 deprecates and no longer configures.
  scrollRestoration: true,
  getScrollRestorationKey: (location) => location.pathname,
  // The shell's content scrolls inside its own element (P0-C): a page opened for the first time starts at the top,
  // one you return to keeps where you were (as the prototype's scroll memory).
  scrollToTopSelectors: ['[data-scroll-restoration-id="isi"]'],
  // Every route gets its own error boundary; the root route has the app-wide one (Muat ulang, Ke Beranda).
  defaultErrorComponent: RouteErrorFallback,
  // An address no route answers: an Indonesian page with Ke Beranda (F2-005).
  defaultNotFoundComponent: NotFoundPage,
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

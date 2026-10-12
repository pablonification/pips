import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

// Create a new router instance
export const router = createRouter({
  routeTree,
  // Replaces the <ScrollRestoration getKey> component, which router 1.170 deprecates and no longer configures.
  scrollRestoration: true,
  getScrollRestorationKey: (location) => location.pathname,
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

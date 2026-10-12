import {
  createFileRoute,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router';

/**
 * The Garis design-system gallery (P0-A): every token, type style, icon, brand mark and component, in both themes.
 * Development and staging only: in a production build `__GARIS_GALLERY__` is false, the import below is dropped and
 * the path sends members home (scripts/verify-production-bundle.mjs checks the gallery isn't shipped).
 */
export const Route = createFileRoute('/dev/garis')({
  beforeLoad: () => {
    if (!__GARIS_GALLERY__) throw redirect({ to: '/' });
  },
  component: __GARIS_GALLERY__
    ? lazyRouteComponent(() => import('~/dev/garis/Gallery'))
    : () => null,
});

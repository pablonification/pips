import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Outlet, createRootRoute, redirect } from '@tanstack/react-router';
import { Toaster } from 'react-hot-toast';
import { queryClient } from '~/api/client';
import { RootErrorFallback } from '~/components/error-fallback';
import { legacyRedirect } from '~/lib/legacy-redirects';

export const Route = createRootRoute({
  // Today's paths (/home, /timeline/$infoId, /settings, …) move permanently to the new ones, keeping the search
  // string and hash. `replace` keeps the old path out of history, so Back doesn't bounce through it.
  beforeLoad: ({ location }) => {
    const target = legacyRedirect(location.pathname);
    if (target !== null) {
      throw redirect({
        href: `${target}${location.searchStr}${location.hash ? `#${location.hash}` : ''}`,
        replace: true,
      });
    }
  },
  component: RootComponent,
  errorComponent: RootErrorFallback,
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Outlet />
      <ReactQueryDevtools />
    </QueryClientProvider>
  );
}

import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Outlet, createRootRoute, redirect } from '@tanstack/react-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from 'react-hot-toast';
import { Toaster as GarisToaster } from '~/components/garis';
import { PushPrompt } from '~/components/push';
import { InstallSheet } from '~/features/profil/InstallSheet';
import { queryClient } from '~/api/client';
import {
  PERSIST_BUSTER,
  PERSIST_MAX_AGE,
  shouldPersistQuery,
} from '~/api/persistence-policy';
import { persister } from '~/api/persister';
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
    // The profile, nearby calendar events, the feed's first page and the courses stay on the device for up
    // to 7 days, so the app opens with them, offline too (SPEC story 135).
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        buster: PERSIST_BUSTER,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      <Toaster />
      <Outlet />
      {/* P1-C: the Garis toasts and the push prompt, for every page including sign-in and first run. */}
      <GarisToaster />
      <PushPrompt />
      <InstallSheet />
      <ReactQueryDevtools />
    </PersistQueryClientProvider>
  );
}

import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { queryClient } from '~/api/client';
import { ME_QUERY_KEY } from '~/api/constants';
import SessionProvider from '~/components/session';
import { AppShell } from '~/components/shell/AppShell';
import { initialLoadUserAcademic } from '~/hooks/useUserAcademic';
import { loginSearch } from '~/lib/safe-redirect';
import { appSearchSchema } from '~/lib/search-params';
import { loadUserCache } from '~/lib/session';

export const Route = createFileRoute('/_app')({
  component: AppLayout,
  validateSearch: (search) => appSearchSchema.parse(search),
  // Runs before any child route loads its code or data. Signed out (the cached user is null), go to sign-in and
  // come back to this exact page afterwards.
  beforeLoad: ({ location }) => {
    const user = loadUserCache();
    initialLoadUserAcademic();
    if (user === null) {
      queryClient.setQueryData([ME_QUERY_KEY], null);
      throw redirect({ to: '/login', search: loginSearch(location.href) });
    }
    if (user && queryClient.getQueryData([ME_QUERY_KEY]) === undefined) {
      // Seeded as already stale, so the session check still runs once the layout mounts.
      queryClient.setQueryData([ME_QUERY_KEY], user, { updatedAt: 0 });
    }
  },
});

function AppLayout() {
  return (
    <SessionProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </SessionProvider>
  );
}

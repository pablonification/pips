import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { queryClient } from '~/api/client';
import Navbar from '~/components/navbar/navbar';
import SessionProvider from '~/components/session';
import { initialLoadUserAcademic } from '~/hooks/useUserAcademic';
import { loginSearch } from '~/lib/safe-redirect';
import { fetchSession, loadUserCache } from '~/lib/session';

const appSearchSchema = z.object({
  showAnnounce: z.boolean().optional(),
});

export const Route = createFileRoute('/_app')({
  component: AppLayout,
  validateSearch: (search) => appSearchSchema.parse(search),
  // Runs before any child route loads its code or data. Signed out (the cached user is null), go to sign-in and
  // come back to this exact page afterwards. With nothing cached (a first visit, or after signing out elsewhere),
  // the session check runs first, so no page asks the API for its data on behalf of someone signed out. If that
  // check fails for any other reason, the page renders and SessionProvider keeps retrying.
  beforeLoad: async ({ location }) => {
    let user = loadUserCache();
    initialLoadUserAcademic();
    if (user === undefined) {
      try {
        user = await queryClient.fetchQuery({
          queryKey: ['me'],
          queryFn: fetchSession,
          retry: false,
        });
      } catch {
        // Offline or a server error: not a sign-out.
      }
    }
    if (user === null) {
      queryClient.setQueryData(['me'], null);
      throw redirect({ to: '/login', search: loginSearch(location.href) });
    }
    if (user && queryClient.getQueryData(['me']) === undefined) {
      // Seeded as already stale, so the session check still runs once the layout mounts.
      queryClient.setQueryData(['me'], user, { updatedAt: 0 });
    }
  },
});

function AppLayout() {
  return (
    <SessionProvider>
      <main className="mx-auto size-full max-w-(--breakpoint-md) overflow-x-hidden overflow-y-auto lg:flex lg:max-w-none">
        <Outlet />
      </main>
      <Navbar />
    </SessionProvider>
  );
}

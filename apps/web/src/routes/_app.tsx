import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { queryClient } from '~/api/client';
import Navbar from '~/components/navbar/navbar';
import SessionProvider from '~/components/session';
import { initialLoadUserAcademic } from '~/hooks/useUserAcademic';
import { loginSearch } from '~/lib/safe-redirect';
import { loadUserCache } from '~/lib/session';

const appSearchSchema = z.object({
  showAnnounce: z.boolean().optional(),
});

export const Route = createFileRoute('/_app')({
  component: AppLayout,
  validateSearch: (search) => appSearchSchema.parse(search),
  // Runs before any child route loads its code or data. Signed out (the cached user is null), go to sign-in and
  // come back to this exact page afterwards.
  beforeLoad: ({ location }) => {
    const user = loadUserCache();
    initialLoadUserAcademic();
    if (user === null) {
      queryClient.setQueryData(['me'], null);
      throw redirect({ to: '/login', search: loginSearch(location.href) });
    }
    if (user && queryClient.getQueryData(['me']) === undefined) {
      queryClient.setQueryData(['me'], user);
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

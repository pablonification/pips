import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { createContext, useEffect } from 'react';
import { UserWithRoles } from '~/api/generated';
import { clearPersistedQueries } from '~/api/persister';
import { common } from '~/copy/common';
import { loginSearch } from '~/lib/safe-redirect';
import {
  fetchSession,
  saveUserCache,
  sessionRetry,
  sessionRetryDelay,
} from '~/lib/session';
import { Button } from './ui/button';

export const SessionContext = createContext<UserWithRoles>(
  null as unknown as UserWithRoles,
);

/**
 * Keeps the signed-in user. Only a 401 from the session check signs out (and sends you to sign-in, then back
 * here). Offline, dropped requests and server errors keep the cached user on screen while the check retries
 * with backoff; with no cached user, a plain error with Coba lagi shows after the second failure.
 */
export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data, failureCount, refetch, isFetching } = useQuery({
    queryKey: ['me'],
    queryFn: fetchSession,
    retry: sessionRetry,
    retryDelay: sessionRetryDelay,
  });

  useEffect(() => {
    if (data !== undefined) {
      saveUserCache(data);
    }
    // Signed out by the server: nothing of this user's stays on the device, and sign-in brings them back here.
    // Navigated once, from an effect: a <Navigate> with a fresh `search` object re-navigates on every render.
    if (data === null) {
      void clearPersistedQueries();
      void router.navigate({
        to: '/login',
        search: loginSearch(router.state.location.href),
        replace: true,
      });
    }
  }, [data, router]);

  if (data === null) return null;

  if (!data) {
    if (failureCount >= 2) {
      return (
        <main
          role="alert"
          className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center"
        >
          <p>{common.errors.sesi}</p>
          <Button
            type="button"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {common.actions.cobaLagi}
          </Button>
        </main>
      );
    }
    // TODO: loading UI
    return <div>Loading...</div>;
  }
  return (
    <SessionContext.Provider value={data}>{children}</SessionContext.Provider>
  );
}

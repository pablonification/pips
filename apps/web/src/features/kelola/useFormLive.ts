import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ME_QUERY_KEY } from '~/api/constants';
import { openLiveSocket } from './live-socket';
import { formResponsesCountKey, latestResponsesQuery } from './queries';

/** What the API emits to `form-admin:{formId}` after each new response (no major). */
export interface LiveResponseEvent {
  total: number;
  nim: string;
  fullName: string;
  submittedAt: string;
}

/**
 * Live Counting's live updates (today's `useFormLiveCounting`), on the admin socket room the API checks on join.
 * - Connects with `auth: { formAdminId }` and the session cookie (`withCredentials`), to the API's origin;
 *   disconnects when the page closes. socket.io-client loads here only, by dynamic import.
 * - A new response: the event's total at once (the page shows the larger of it and the fetched count, so the
 *   number never goes backwards), then the count and the newest five are fetched again (rows carry the major).
 * - After a drop, on reconnecting: the count and the newest five again, so nothing missed is lost.
 * - If socket.io-client can't load, or the server ends the connection, it tries again (live-socket.ts).
 * Exported for Beranda's Kelola card, which could go live with it (story 38).
 */
export function useFormLive(formId: string, enabled = true) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [last, setLast] = useState<LiveResponseEvent | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      void queryClient.invalidateQueries({
        queryKey: formResponsesCountKey(formId),
      });
      void queryClient.invalidateQueries({
        queryKey: latestResponsesQuery(formId).queryKey,
      });
    };
    const close = openLiveSocket(
      () =>
        import('socket.io-client').then(({ io }) =>
          io(import.meta.env.VITE_API_URL || window.location.origin, {
            auth: { formAdminId: formId },
            withCredentials: true,
          }),
        ),
      {
        onStatus: setConnected,
        onReconnect: refresh,
        events: {
          'form:new-response': (event: LiveResponseEvent) => {
            setLast((prev) =>
              prev && prev.total > event.total ? prev : event,
            );
            refresh();
          },
        },
        // The server ended the connection: still signed in (a new cookie), connect again; signed out, the session
        // provider takes you to sign-in.
        checkSession: () =>
          queryClient
            .invalidateQueries({ queryKey: [ME_QUERY_KEY] })
            .then(() => !!queryClient.getQueryData([ME_QUERY_KEY])),
      },
    );
    return () => {
      close();
      setConnected(false);
    };
  }, [formId, enabled, queryClient]);

  return { connected, last };
}

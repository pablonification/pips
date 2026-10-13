import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
 * Exported for Beranda's Kelola card, which could go live with it (story 38).
 */
export function useFormLive(formId: string, enabled = true) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [last, setLast] = useState<LiveResponseEvent | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let closed = false;
    let disconnect: (() => void) | null = null;
    const refresh = () => {
      void queryClient.invalidateQueries({
        queryKey: formResponsesCountKey(formId),
      });
      void queryClient.invalidateQueries({
        queryKey: latestResponsesQuery(formId).queryKey,
      });
    };
    void import('socket.io-client').then(({ io }) => {
      if (closed) return;
      const socket = io(
        import.meta.env.VITE_API_URL || window.location.origin,
        {
          auth: { formAdminId: formId },
          withCredentials: true,
        },
      );
      let connectedBefore = false;
      socket.on('connect', () => {
        setConnected(true);
        if (connectedBefore) refresh();
        connectedBefore = true;
      });
      socket.on('disconnect', () => setConnected(false));
      socket.on('form:new-response', (event: LiveResponseEvent) => {
        setLast((prev) => (prev && prev.total > event.total ? prev : event));
        refresh();
      });
      disconnect = () => {
        socket.removeAllListeners();
        socket.disconnect();
      };
    });
    return () => {
      closed = true;
      disconnect?.();
      setConnected(false);
    };
  }, [formId, enabled, queryClient]);

  return { connected, last };
}

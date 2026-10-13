/**
 * The Curhat area's layout (`/layanan/curhat`): it owns the one connection, so it stays open between the list and a
 * room and closes when you leave (SPEC "Connection and delivery"). Welfare (`curhatadmin`) keeps today's screen until
 * P3-C's inbox, which opens its own sockets, so no connection is made for them here.
 */
import { useQueryClient } from '@tanstack/react-query';
import { Outlet } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import useSession from '~/hooks/auth/useSession';
import { can } from '~/lib/capabilities';
import { CurhatClient, DeferredSocket, type SocketLike } from './client';
import {
  CurhatClientContext,
  putMessage,
  receiveMessage,
  ROOMS_KEY,
  UNREAD_KEY,
} from './data';
import './curhat.css';

/** Welfare's view until P3-C: today's screen (layanan/curhat/-components). */
export const isWelfare = (user: Parameters<typeof can>[0]) =>
  can(user, 'respondCurhat');

export function CurhatArea() {
  const me = useSession();
  if (isWelfare(me)) return <Outlet />;
  return <MemberArea />;
}

function openSocket(): Promise<SocketLike> {
  return import('socket.io-client').then(({ io }) =>
    io(import.meta.env.VITE_API_URL, {
      // The API reads the session from the cookie on the handshake (another origin in production).
      withCredentials: true,
      auth: { curhat: true },
    }),
  );
}

function MemberArea() {
  const qc = useQueryClient();
  const [client, setClient] = useState<CurhatClient | null>(null);

  useEffect(() => {
    const c: CurhatClient = new CurhatClient(new DeferredSocket(openSocket), {
      onReply: (message) => receiveMessage(qc, c, message),
      // Back after a drop: fetch the rooms and counts again to catch what was missed.
      onReconnect: () => {
        void qc.invalidateQueries({ queryKey: ROOMS_KEY, exact: true });
        void qc.invalidateQueries({ queryKey: UNREAD_KEY });
      },
      onDelivered: (_entry, message) => {
        putMessage(qc, message);
      },
    });
    setClient(c);
    return () => c.close();
  }, [qc]);

  return (
    <CurhatClientContext.Provider value={client}>
      <Outlet />
    </CurhatClientContext.Provider>
  );
}

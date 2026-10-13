/**
 * The Curhat area's layout (`/layanan/curhat`): it owns the one connection, so it stays open between the list and a
 * room and closes when you leave (SPEC "Connection and delivery"). Welfare (`curhatadmin`) keeps today's screen until
 * P3-C's inbox, which opens its own sockets, so no connection is made for them here.
 */
import { hashKey, useQueryClient } from '@tanstack/react-query';
import { Outlet } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import useSession from '~/hooks/auth/useSession';
import type { ListChatroom } from '~/api/generated';
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
/** The session check's key (components/session.tsx). */
const ME_KEY = ['me'];

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
      // Refusals Kirim ulang can't get past: a room deleted elsewhere shows "Ruang tidak ditemukan" once the rooms
      // are fetched again; a session gone sends you to sign-in (SessionProvider).
      onRefused: (error) => {
        if (error === 'forbidden')
          void qc.invalidateQueries({ queryKey: ROOMS_KEY, exact: true });
        else void qc.invalidateQueries({ queryKey: ME_KEY });
      },
      // The server cut the connection (its session expired): check the session; still signed in (a new cookie),
      // connect again; signed out, SessionProvider takes you to sign-in.
      onSessionEnded: () => {
        void qc.invalidateQueries({ queryKey: ME_KEY }).then(() => {
          if (qc.getQueryData(ME_KEY)) c.reconnect();
        });
      },
    });
    // What you sent settles against the rooms cache whenever it changes, once no refetch is running: one that started
    // before a save would land with an older list (a delivered message the cache lost is put back), and the server's
    // copy of a message whose acknowledgement was lost retires its Gagal entry (OPEN-QUESTIONS A11).
    const rooms = hashKey(ROOMS_KEY);
    const settle = () => {
      if (qc.isFetching({ queryKey: ROOMS_KEY, exact: true })) return;
      for (const message of c.settle(qc.getQueryData<ListChatroom>(ROOMS_KEY)))
        putMessage(qc, message);
    };
    const unsubscribe = qc.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.queryHash === rooms) settle();
    });
    setClient(c);
    return () => {
      unsubscribe();
      c.close();
    };
  }, [qc]);

  return (
    <CurhatClientContext.Provider value={client}>
      <Outlet />
    </CurhatClientContext.Provider>
  );
}

/**
 * The Kelola Curhat layout (P3-C): Welfare's one connection for the inbox and its rooms, opened only once
 * `KelolaGate` lets them in and closed when they leave. The handshake's `auth: { curhat: true }` joins Welfare to
 * every room (the API, OPEN-QUESTIONS A7); everything else is the member side's connection (`useCurhatConnection`).
 */
import { Outlet } from '@tanstack/react-router';
import { useCurhatConnection } from '~/features/curhat/Area';
import { CurhatClientContext } from '~/features/curhat/data';
import './inbox.css';

export function InboxArea() {
  const client = useCurhatConnection({ welfare: true });
  return (
    <CurhatClientContext.Provider value={client}>
      <Outlet />
    </CurhatClientContext.Provider>
  );
}

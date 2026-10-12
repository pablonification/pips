import type { Socket } from 'socket.io';
import { registerCurhatSocket, type CurhatSocketDeps } from './curhat';
import { readSocketSession, type SocketSession } from './session';

export function formAdminRoom(formId: string) {
  return `form-admin:${formId}`;
}

export interface ConnectionDeps {
  jwtSecret: string;
  getUserRoles: (userId: string) => Promise<string[]>;
  curhat: CurhatSocketDeps;
  onError?: (error: unknown) => void;
}

/**
 * Everything a new socket gets: its session from the handshake cookie, Curhat (`curhat.ts`) and Live Counting's
 * admin room. Kept apart from `setup.ts` so tests can run it on a real socket.io server with fake storage.
 */
export function createConnectionHandler(deps: ConnectionDeps) {
  return (socket: Socket) => {
    const session: Promise<SocketSession | null> = readSocketSession(
      socket.handshake.headers.cookie,
      deps.jwtSecret,
      deps.getUserRoles,
    )
      .then((s) => {
        if (s) socket.data.userId = s.userId;
        return s;
      })
      .catch((error) => {
        deps.onError?.(error);
        return null;
      });

    registerCurhatSocket(socket, session, deps.curhat);

    const formAdminId = socket.handshake.auth.formAdminId as string | undefined;
    if (formAdminId) {
      // Live counting rooms expose NIM + name of everyone who has submitted
      // a form response — unlike chat rooms, membership here must be
      // verified against the 'admin' role before joining, not just trusted
      // based on client-supplied ids. The auth cookie is httpOnly, so the FE
      // can't read the JWT to send it explicitly — it rides along on the
      // handshake request instead (client connects with withCredentials).
      void session.then(async (s) => {
        const isAdmin = s?.roles.includes('admin') ?? false;
        if (isAdmin) {
          await socket.join(formAdminRoom(formAdminId));
        }
      });
    }
  };
}

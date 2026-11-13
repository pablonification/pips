import type { Server, Socket } from 'socket.io';
import {
  joinCurhatRooms,
  registerCurhatSocket,
  type CurhatSocketDeps,
} from './curhat';
import { readSocketSession, type SocketSession } from './session';

/** setTimeout's longest delay (about 24.8 days); a later expiry is reached in steps. */
const MAX_TIMEOUT = 2 ** 31 - 1;

/** Disconnects the socket when its session expires, so it neither sends nor receives on an expired token. */
function disconnectAt(socket: Socket, expiresAt: number) {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    const left = expiresAt - Date.now();
    timer = setTimeout(
      left > MAX_TIMEOUT
        ? schedule
        : () => {
            socket.disconnect(true);
          },
      Math.min(Math.max(left, 0), MAX_TIMEOUT),
    );
  };
  schedule();
  socket.once('disconnect', () => {
    clearTimeout(timer);
  });
}

export function formAdminRoom(formId: string) {
  return `form-admin:${formId}`;
}

interface ConnectionDeps {
  jwtSecret: string;
  getUserRoles: (userId: string) => Promise<string[]>;
  curhat: Omit<CurhatSocketDeps, 'getUserRoles'>;
  onError?: (error: unknown) => void;
}

/**
 * Everything a new socket gets: its session from the handshake cookie, Curhat (`curhat.ts`) and Live Counting's
 * admin room. Kept apart from `setup.ts` so tests can run it on a real socket.io server with fake storage.
 */
export function handleConnections(io: Server, deps: ConnectionDeps) {
  const curhat = { ...deps.curhat, getUserRoles: deps.getUserRoles };
  /** What the handshake read: the session (null when there is none), or `failed` when it couldn't be read. */
  const handshakes = new WeakMap<Socket, SocketSession | null | 'failed'>();

  // The session is read and the Curhat rooms joined before socket.io confirms the connection. Clients read the rooms
  // once they hear they are connected, so a message saved after that read is one this socket is already in the room
  // for.
  io.use((socket, next) => {
    void (async () => {
      try {
        const s = await readSocketSession(
          socket.handshake.headers.cookie,
          deps.jwtSecret,
          deps.getUserRoles,
        );
        if (s) {
          socket.data.userId = s.userId;
          await joinCurhatRooms(socket, s, curhat);
        }
        handshakes.set(socket, s);
      } catch (error) {
        deps.onError?.(error);
        handshakes.set(socket, 'failed');
      }
      next();
    })();
  });

  io.on('connection', (socket) => {
    const read = handshakes.get(socket);
    handshakes.delete(socket);
    if (read === undefined || read === 'failed') {
      // The session or the rooms couldn't be read (the database is unreachable): refuse the connection rather than
      // keep a socket that looks connected but is refused everything or misses its rooms. Clients hear
      // `io server disconnect`, check their session and connect again (a refusal in the middleware would stop them
      // reconnecting). Disconnecting leaves every room it joined.
      socket.disconnect(true);
      return;
    }
    if (read?.expiresAt != null) disconnectAt(socket, read.expiresAt);
    const session = Promise.resolve(read);

    registerCurhatSocket(socket, session, curhat);

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
  });
}

import { settleBackground } from './background';

let shuttingDown = false;

/** True once shutdown has started: `/health` then answers 503 so a load balancer stops sending requests. */
export function isShuttingDown() {
  return shuttingDown;
}

export interface ShutdownSteps {
  /** Stops scheduled jobs (the reminder cron). */
  stopJobs: () => void;
  /** Stops accepting connections and resolves once in-flight requests have finished. */
  closeServer: () => Promise<void>;
  /** Disconnects every socket. */
  closeSockets: () => Promise<void>;
  /** Closes the database pool. */
  closeDatabase: () => Promise<void>;
  exit: (code: number) => void;
  log?: (message: string, error?: unknown) => void;
}

/**
 * Shuts down on SIGTERM (a deploy, `docker stop`) without cutting work off: stop the jobs and new connections,
 * disconnect the sockets (their clients reconnect to the next instance), let in-flight requests finish, then the push
 * fan-outs they started (`settleBackground`), close the database pool and exit 0. Whatever is still going after
 * `timeoutMs` is cut off with exit 1, inside Docker's 10 s grace period.
 */
export function createShutdown(steps: ShutdownSteps, timeoutMs = 8000) {
  const log = steps.log ?? console.log;
  let started: Promise<void> | undefined;
  return async (signal: string) => {
    if (started) {
      await started;
      return;
    }
    shuttingDown = true;
    log(`${signal}: shutting down`);
    const begun = Date.now();
    const deadline = setTimeout(() => {
      log('Shutdown took too long; exiting');
      steps.exit(1);
    }, timeoutMs);
    deadline.unref();
    started = (async () => {
      try {
        steps.stopJobs();
        const serverClosed = steps.closeServer();
        await steps.closeSockets();
        await serverClosed;
        const left = timeoutMs - (Date.now() - begun) - 1000;
        if (!(await settleBackground(Math.max(0, left)))) {
          log('Background work still running; closing anyway');
        }
        await steps.closeDatabase();
        clearTimeout(deadline);
        log('Shut down cleanly');
        steps.exit(0);
      } catch (error) {
        log('Shutdown failed:', error);
        clearTimeout(deadline);
        steps.exit(1);
      }
    })();
    await started;
  };
}

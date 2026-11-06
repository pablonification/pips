const pending = new Set<Promise<unknown>>();

/** Keeps `work` in the set shutdown waits for (`settleBackground`) until it settles. */
export async function trackBackground<T>(work: Promise<T>): Promise<T> {
  pending.add(work);
  const forget = () => pending.delete(work);
  work.then(forget, forget);
  return await work;
}

/**
 * Work a request starts but doesn't wait for (a push fan-out, the last sign-in time). Its failure is logged and goes
 * no further: Node 22 ends the process on an unhandled rejection, so one failed database write in a burst used to
 * take down the API and every socket with it. Shutdown waits for it a few seconds (`settleBackground`).
 */
export function runInBackground(
  name: string,
  work: Promise<unknown>,
  log: (message: string, error: unknown) => void = console.error,
): void {
  void trackBackground(
    work.catch((error: unknown) => {
      log(`${name} failed:`, error);
    }),
  );
}

/** Waits for the background work still going, at most `timeoutMs`; true when all of it finished. */
export async function settleBackground(timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<false>((resolve) => {
    timer = setTimeout(() => {
      resolve(false);
    }, timeoutMs);
  });
  const settle = async (): Promise<true> => {
    // Work can start more work (a fan-out, then its pruning), so wait until the set stays empty.
    while (pending.size > 0) await Promise.allSettled([...pending]);
    return true;
  };
  try {
    return await Promise.race([settle(), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The last line of defence for a rejection nothing caught: log it and keep serving, instead of Node's default of
 * ending the process. Installed once, at start (`index.ts`).
 */
export function installUnhandledRejectionLogger(
  log: (message: string, error: unknown) => void = console.error,
): void {
  process.on('unhandledRejection', (reason) => {
    log('Unhandled rejection:', reason);
  });
}

/**
 * Work a request starts but doesn't wait for (a push fan-out, the last sign-in time). Its failure is logged and goes
 * no further: Node 22 ends the process on an unhandled rejection, so one failed database write in a burst used to
 * take down the API and every socket with it.
 */
export function runInBackground(
  name: string,
  work: Promise<unknown>,
  log: (message: string, error: unknown) => void = console.error,
): void {
  work.catch((error: unknown) => {
    log(`${name} failed:`, error);
  });
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

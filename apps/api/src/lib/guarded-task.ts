/**
 * A scheduled task's run that fails (the database is down, say) is logged and the next run goes ahead. Left
 * unhandled, the rejection would end the whole API: Node exits on an unhandled rejection, and the `cron` package
 * doesn't catch one from an async tick. CI's image check found it: with no database the API died at the first
 * calendar run (2026-10-13).
 */
export function guardedTask(
  name: string,
  run: () => Promise<void>,
  log: (message: string, error: unknown) => void = console.error,
): () => Promise<void> {
  return async () => {
    try {
      await run();
    } catch (error) {
      log(`${name} failed:`, error);
    }
  };
}

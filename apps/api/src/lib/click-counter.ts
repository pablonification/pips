/**
 * Counts clicks in memory and writes them together every few seconds, so a redirect never waits for the database
 * and a burst on one link is one write, not one per click. The API is one process (decision 10); a crash loses at
 * most the last few seconds of counts, and shutdown writes what is left (`flush`).
 */
export function createClickCounter({
  write,
  intervalMs = 5000,
  onError = (error: unknown) => {
    console.error('Short link clicks failed:', error);
  },
}: {
  write: (counts: Map<string, number>) => Promise<void>;
  intervalMs?: number;
  onError?: (error: unknown) => void;
}) {
  let counts = new Map<string, number>();
  let timer: NodeJS.Timeout | undefined;
  let writing: Promise<void> = Promise.resolve();

  async function flush() {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (counts.size === 0) {
      await writing;
      return;
    }
    const batch = counts;
    counts = new Map();
    writing = writing
      .then(async () => {
        await write(batch);
      })
      .catch((error: unknown) => {
        // Not lost on a passing failure: they go with the next batch.
        for (const [id, n] of batch) counts.set(id, (counts.get(id) ?? 0) + n);
        onError(error);
      });
    await writing;
  }

  return {
    add(id: string) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
      if (!timer) {
        timer = setTimeout(() => {
          flush().catch(onError);
        }, intervalMs);
        timer.unref();
      }
    },
    flush,
    /** Clicks not written yet, for tests. */
    pending: () => new Map(counts),
  };
}

export type ClickCounter = ReturnType<typeof createClickCounter>;

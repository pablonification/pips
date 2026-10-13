/**
 * When to register the service worker. The first paint doesn't need it, and once registered it precaches every route
 * chunk, which would compete with the first page's own requests on a slow connection. So it waits until the page has
 * loaded and nothing has been fetching for `quietMs` (the route's code, then its data, have arrived), then until the
 * browser is idle; or `maxWaitMs` after load, whatever happens. SPEC "Performance architecture and budgets": Beranda's
 * requests before content.
 */
export interface SettleSource {
  /** How many queries are fetching now. */
  isFetching: () => number;
  /** Calls `listener` whenever a query changes; returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
}

export interface SettleTimers {
  setTimeout: (cb: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  idle: (cb: () => void) => void;
}

/** Calls `run` once: after `source` has had no query fetching for `quietMs` (then when idle), or after `maxWaitMs`. */
export function runWhenSettled(
  source: SettleSource,
  run: () => void,
  timers: SettleTimers,
  { quietMs = 1_000, maxWaitMs = 10_000 } = {},
): void {
  let done = false;
  let quiet: unknown;
  const finish = () => {
    if (done) return;
    done = true;
    unsubscribe();
    timers.clearTimeout(cap);
    timers.clearTimeout(quiet);
    run();
  };
  const cap = timers.setTimeout(finish, maxWaitMs);
  // Every change restarts the quiet period; it ends only with nothing fetching.
  const restart = () => {
    if (done) return;
    timers.clearTimeout(quiet);
    quiet = timers.setTimeout(() => {
      if (source.isFetching() === 0)
        timers.idle(() => {
          if (source.isFetching() === 0) finish();
          else restart();
        });
    }, quietMs);
  };
  const unsubscribe = source.subscribe(restart);
  restart();
}

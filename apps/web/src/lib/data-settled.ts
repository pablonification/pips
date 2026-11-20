import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/** How long nothing must be loading, after something has, before the page counts as settled. */
export const SETTLE_MS = 300;
/** A page that loads nothing at all counts as settled after this long. */
export const SETTLE_MAX_MS = 2000;

let settled = false;
let watching = false;
const waiting = new Set<() => void>();

/**
 * Watches the query cache outside React until the first page has settled: something was loading and nothing has been
 * for `SETTLE_MS` (before the page's own code has loaded, nothing is loading yet, so quiet alone proves nothing), or
 * `SETTLE_MAX_MS` passed with nothing loading. Outside React on purpose: a hook subscribed to every fetch would
 * re-render on each one, synchronously, in the middle of the router's transitions.
 */
function watch(client: QueryClient) {
  if (watching || settled) return;
  watching = true;
  let fetchedOnce = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cache = client.getQueryCache();
  const check = () => {
    if (client.isFetching() > 0) {
      fetchedOnce = true;
      clearTimeout(timer);
      timer = undefined;
      return;
    }
    if (timer !== undefined) return;
    timer = setTimeout(
      () => {
        timer = undefined;
        if (client.isFetching() > 0) return;
        settled = true;
        unsubscribe();
        // Screenshots wait for it (e2e/visual), so a photo is either in the picture or never was.
        document.documentElement.dataset.settled = '';
        for (const done of waiting) done();
        waiting.clear();
      },
      fetchedOnce ? SETTLE_MS : SETTLE_MAX_MS,
    );
  };
  const unsubscribe = cache.subscribe(check);
  check();
}

/**
 * True once the first page's data has arrived (see `watch`); later pages don't wait again, since the photos it showed
 * are in the browser's cache. Decorative pictures (people's photos) wait for it, so a cold first load asks only for
 * what the content needs (beranda.spec.ts, "a cold first load asks for at most 15 resources").
 */
export function useDataSettled() {
  const client = useQueryClient();
  const [ready, setReady] = useState(settled);
  useEffect(() => {
    if (settled) {
      setReady(true);
      return;
    }
    const done = () => setReady(true);
    waiting.add(done);
    watch(client);
    return () => {
      waiting.delete(done);
    };
  }, [client]);
  return ready;
}

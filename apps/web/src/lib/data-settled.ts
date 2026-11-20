import { useIsFetching } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/** How long nothing must be loading, after something has, before the page counts as settled. */
export const SETTLE_MS = 300;
/** A page that loads nothing at all counts as settled after this long. */
export const SETTLE_MAX_MS = 2000;

// Once the first page has settled, later pages don't wait again: the photos it showed are in the browser's cache.
let settledOnce = false;
let fetchedOnce = false;

/**
 * True once the page's data has arrived: something was loading and nothing has been for `SETTLE_MS` (before the
 * page's own code has loaded, nothing is loading yet, so quiet alone proves nothing), or `SETTLE_MAX_MS` have passed
 * with nothing loading. Decorative pictures (people's photos) wait for it, so a cold first load asks only for what the
 * content needs (beranda.spec.ts, "a cold first load asks for at most 15 resources").
 */
export function useDataSettled() {
  const fetching = useIsFetching();
  if (fetching > 0) fetchedOnce = true;
  const [settled, setSettled] = useState(settledOnce);
  useEffect(() => {
    if (settled || fetching > 0) return;
    const id = setTimeout(
      () => {
        settledOnce = true;
        setSettled(true);
      },
      fetchedOnce ? SETTLE_MS : SETTLE_MAX_MS,
    );
    return () => clearTimeout(id);
  }, [settled, fetching]);
  return settled;
}

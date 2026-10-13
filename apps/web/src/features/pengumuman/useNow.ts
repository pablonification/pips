import { useEffect, useState } from 'react';

/** The current time, refreshed every 30 s: an open menu unlocks Umumkan ulang without a refetch. */
export function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

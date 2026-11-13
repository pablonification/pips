import { useEffect, useState } from 'react';

/** True once `active` has held for `ms`: skeletons appear only for a load slower than 300 ms, so a quick answer doesn't flash them. */
export function useDelayed(active: boolean, ms = 300): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!active) {
      setLate(false);
      return;
    }
    const id = setTimeout(() => setLate(true), ms);
    return () => clearTimeout(id);
  }, [active, ms]);
  return active && late;
}

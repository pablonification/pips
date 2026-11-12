import { useCallback, useEffect, useState, type SetStateAction } from 'react';
import { keepUnsent, readUnsent } from '~/lib/unsent-text';

/**
 * A text box's state that is also kept in the tab under `key` (src/lib/unsent-text.ts): after a reload it opens with
 * what was typed and not sent. Setting it to '' (sent) clears what was kept.
 */
export function useUnsentText(key: string) {
  const [state, setState] = useState(() => ({
    key,
    text: readUnsent(key) ?? '',
  }));
  // Another post or room in the same component: its own kept text.
  const current =
    state.key === key ? state : { key, text: readUnsent(key) ?? '' };
  if (current !== state) setState(current);
  useEffect(() => {
    keepUnsent(current.key, current.text);
  }, [current.key, current.text]);
  const setText = useCallback(
    (next: SetStateAction<string>) =>
      setState((s) => ({
        key: s.key,
        text: typeof next === 'function' ? next(s.text) : next,
      })),
    [],
  );
  return [current.text, setText] as const;
}

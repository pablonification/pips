/**
 * Pieces Ding Dong, Testi Matkul, NIM Finder and Info Lomba share (P2-B): the external mark and chevron that end a
 * row (garis/ui.js `extMark`, `chev`), whether the browser is online, and one way to show a list's loading, error
 * and offline states with P0-A's components (P2-B brief, "States").
 */
import type { UseQueryResult } from '@tanstack/react-query';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { ErrorState, OfflineBanner } from '~/components/garis';
import { IconLanjut } from '~/components/icons/lanjut';
import { IconLuar } from '~/components/icons/luar';
import { common } from '~/copy/common';
import { hm } from '~/lib/dates';

const subscribe = (l: () => void) => {
  window.addEventListener('online', l);
  window.addEventListener('offline', l);
  return () => {
    window.removeEventListener('online', l);
    window.removeEventListener('offline', l);
  };
};

/** Whether the browser says it's online. */
export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * A search box's text that also lives in the URL (P0-B's `q`), so Back and reload keep it and a link can open the
 * page filled in. The box answers at once; the URL follows with `replace`, a moment behind, and those values never
 * overwrite what's typed. A different `q` arriving from outside (another link to this page) replaces the text.
 */
export function useUrlText(
  urlQ: string | undefined,
  writeUrl: (q: string | undefined) => void,
): [string, (text: string) => void] {
  const [text, setText] = useState(urlQ ?? '');
  const ours = useRef(new Set<string>());
  useEffect(() => {
    if (urlQ === undefined || ours.current.has(urlQ)) return;
    ours.current.clear();
    setText(urlQ);
  }, [urlQ]);
  return [
    text,
    (v: string) => {
      ours.current.add(v);
      setText(v);
      writeUrl(v || undefined);
    },
  ];
}

/**
 * The value after typing has paused for `ms`. Each change cancels the one before (today's NIM Finder never did, so
 * every keystroke's value was applied and each one of 3 or more characters sent its own request).
 */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

/** The ↗ that ends a row opening another site, with its hidden "(situs luar, tab baru)" (`extMark`). */
export function ExtMark() {
  return (
    <span className="g-chev">
      <IconLuar size={16} />
      <span className="sr-only"> {common.shell.situsLuar}</span>
    </span>
  );
}

/** The chevron that ends a row opening a page (`chev`). */
export function Chev() {
  return (
    <span className="g-chev">
      <IconLanjut size={18} />
    </span>
  );
}

/** Hidden words after a link's visible label that say it opens another site in a new tab. */
export function NewTab() {
  return <span className="sr-only"> {common.shell.situsLuar}</span>;
}

/**
 * A list's states: its data (under the offline banner with the last update time when offline), else an error with
 * Coba lagi (offline with nothing kept: the same, saying to check the connection), else the skeleton.
 */
export function Loaded<T>({
  query,
  failed,
  offlineText,
  skeleton,
  children,
}: {
  query: UseQueryResult<T>;
  /** What failed, in Indonesian ("Mata kuliahmu gagal dimuat."). */
  failed: string;
  /** The fix when offline ("Periksa koneksimu, lalu coba lagi."). */
  offlineText: string;
  skeleton: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const online = useOnline();
  if (query.data !== undefined)
    return (
      <>
        {online ? null : (
          <OfflineBanner updatedAt={hm(query.dataUpdatedAt || Date.now())} />
        )}
        {children(query.data)}
      </>
    );
  if (query.isError || !online)
    return (
      <ErrorState
        title={failed}
        text={online ? undefined : offlineText}
        onRetry={() => void query.refetch()}
        retrying={online && query.isFetching}
      />
    );
  return skeleton;
}

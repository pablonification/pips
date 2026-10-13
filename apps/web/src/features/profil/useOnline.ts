import { useSyncExternalStore } from 'react';

const subscribe = (l: () => void) => {
  window.addEventListener('online', l);
  window.addEventListener('offline', l);
  return () => {
    window.removeEventListener('online', l);
    window.removeEventListener('offline', l);
  };
};

/** Whether the browser says it's online; offline screens show what was kept, under the offline banner. */
export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** "07.45": a time in WIB, the app's format (SPEC "Copy and language"). */
export function jamWib(ms: number) {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  })
    .format(new Date(ms))
    .replace(':', '.');
}

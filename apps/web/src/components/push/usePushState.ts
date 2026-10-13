import { useEffect, useSyncExternalStore } from 'react';
import { push as copy } from '~/copy/push';
import type { PushStatus } from '~/lib/push-state';
import { pushStore, refreshPushState, watchPushState } from './push-store';

/** This device's push state, shared by every screen; read on first use and when the member returns to the tab. */
export function usePushState() {
  const { status } = useSyncExternalStore(
    pushStore.subscribe,
    pushStore.get,
    pushStore.get,
  );
  useEffect(() => {
    watchPushState();
    if (pushStore.get().status === null) void refreshPushState();
  }, []);
  return { status, loading: status === null };
}

/** The Profil row's words for a state, and its colour: a status is always a mark, a word and a colour. */
export function pushStatusWords(status: PushStatus): {
  text: string;
  tone: 'success' | 'danger' | 'muted';
} {
  switch (status) {
    case 'aktif':
      return { text: copy.baris.aktif, tone: 'success' };
    case 'belum':
      return { text: copy.baris.belum, tone: 'danger' };
    case 'diblokir':
      return { text: copy.baris.diblokir, tone: 'danger' };
    case 'perlu-pasang':
      return { text: copy.baris.perluPasang, tone: 'danger' };
    case 'tidak-didukung':
      return { text: copy.baris.tidakDidukung, tone: 'muted' };
  }
}

import { useSyncExternalStore } from 'react';
import { Button, Modal, toast } from '~/components/garis';
import { focusPageTitle } from '~/components/shell/focus';
import { common } from '~/copy/common';
import { push as copy } from '~/copy/push';
import {
  pushStore,
  settlePushPrompt,
  turnPushOn,
  type PushPromptResult,
} from './push-store';

/** The toast after Nyalakan or its Coba lagi (garis/app.js `push-allow`, `push-deny`; errors are new copy). */
export function toastPushResult(result: Exclude<PushPromptResult, 'tutup'>) {
  if (result === 'aktif') toast.success(copy.toast.menyala);
  else if (result === 'nanti') toast.success(copy.toast.tetapMati);
  else if (result === 'diblokir') toast.error(copy.toast.diblokir);
  else
    toast.error(copy.toast.gagal, {
      action: {
        label: common.actions.cobaLagi,
        onClick: () => void turnPushOn().then(toastPushResult),
      },
    });
}

/** After the prompt closes, the button that opened it may be gone (the card changed state): focus the title. */
function keepFocus() {
  requestAnimationFrame(() => {
    if (!document.activeElement || document.activeElement === document.body)
      focusPageTitle();
  });
}

/**
 * "Nyalakan notifikasi?" (garis/screens-more.js `OV.push`). Mounted once at the root; opened with `openPushPrompt()`.
 * Permission is asked only from its Nyalakan.
 */
export function PushPrompt() {
  const { promptOpen, pending, status } = useSyncExternalStore(
    pushStore.subscribe,
    pushStore.get,
    pushStore.get,
  );

  const close = (result: PushPromptResult) => {
    settlePushPrompt(result);
    keepFocus();
  };

  const nyalakan = async () => {
    if (pending) return;
    const result = await turnPushOn();
    close(result);
    toastPushResult(result);
  };

  const askable = status === 'belum' || status === null;
  const body =
    status === 'diblokir'
      ? copy.kartu.diblokirIsi
      : status === 'perlu-pasang'
        ? copy.kartu.perluPasangIsi
        : status === 'tidak-didukung'
          ? copy.kartu.tidakDidukungIsi
          : copy.prompt.isi;

  return (
    <Modal
      open={promptOpen}
      onOpenChange={(open) => {
        if (!open && !pending) close('tutup');
      }}
      small
      title={copy.prompt.judul}
      footer={
        askable ? (
          <>
            <Button
              variant="paper"
              onClick={() => {
                close('nanti');
                toastPushResult('nanti');
              }}
            >
              {copy.prompt.nanti}
            </Button>
            <Button
              variant="gold"
              aria-disabled={pending || undefined}
              onClick={() => void nyalakan()}
            >
              {pending ? copy.prompt.menyalakan : copy.prompt.nyalakan}
            </Button>
          </>
        ) : null
      }
    >
      <p className="t-sm text-fg-2">{body}</p>
      {askable ? <p className="t-cap text-fg-3">{copy.prompt.iphone}</p> : null}
    </Modal>
  );
}

import { useSyncExternalStore } from 'react';
import { Button, Item, Modal, Tile, toast } from '~/components/garis';
import { IconBagikan } from '~/components/icons/bagikan';
import { IconCentang } from '~/components/icons/centang';
import { IconLuar } from '~/components/icons/luar';
import { IconPasang } from '~/components/icons/pasang';
import { IconTambah } from '~/components/icons/tambah';
import { profil } from '~/copy/profil';
import {
  closeInstallSheet,
  currentInstallWay,
  installStore,
  promptInstall,
} from './install-store';

const copy = profil.pasang;

/**
 * Pasang PIPS! (a sheet on phones and tablets, a dialog on desktop), by platform: Android Chrome's own prompt, the
 * iPhone's steps, LINE told to open a real browser, or "already installed". Garis icons only. Mounted once at the
 * root; opened with `openInstallSheet()`.
 */
export function InstallSheet() {
  const { open } = useSyncExternalStore(
    installStore.subscribe,
    installStore.get,
    installStore.get,
  );
  const way = currentInstallWay();

  const steps =
    way === 'iphone'
      ? ([
          [<IconBagikan size={20} key="i" />, copy.langkahIphone1],
          [<IconTambah size={20} key="i" />, copy.langkahIphone2],
          [<IconPasang size={20} key="i" />, copy.langkahIphone3],
        ] as const)
      : null;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) closeInstallSheet();
      }}
      small
      title={copy.judul}
      footer={
        way === 'prompt' ? (
          <Button
            variant="gold"
            onClick={() =>
              void promptInstall().then((ok) => {
                closeInstallSheet();
                if (ok) toast.success(copy.berhasil);
              })
            }
          >
            <IconPasang size={16} />
            {copy.tombol}
          </Button>
        ) : null
      }
    >
      {way === 'terpasang' ? (
        <p className="flex items-center gap-2 t-sub">
          <span className="text-success">
            <IconCentang size={20} />
          </span>
          {copy.terpasang}
        </p>
      ) : (
        <p className="t-sm text-fg-2">{copy.isi}</p>
      )}
      {steps ? (
        <ol className="g-ruled-list">
          {steps.map(([icon, text], i) => (
            <li key={i}>
              <Item center>
                <Tile size="sm">{icon}</Tile>
                <span className="t-sm">
                  <span className="num">{i + 1}. </span>
                  {text}
                </span>
              </Item>
            </li>
          ))}
        </ol>
      ) : null}
      {way === 'line' ? (
        <p className="flex items-start gap-2 t-sm">
          <span className="mt-0.5 text-fg-2">
            <IconLuar size={16} />
          </span>
          {copy.line}
        </p>
      ) : null}
      {way === 'android' ? <p className="t-sm">{copy.android}</p> : null}
      {way === 'lainnya' ? <p className="t-sm">{copy.lainnya}</p> : null}
    </Modal>
  );
}

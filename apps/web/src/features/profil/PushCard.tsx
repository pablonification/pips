import { Button, Card, Skeleton, SkeletonBar, toast } from '~/components/garis';
import { IconCentang } from '~/components/icons/centang';
import { IconLonceng } from '~/components/icons/lonceng';
import { IconPeringatan } from '~/components/icons/peringatan';
import { openPushPrompt, usePushState } from '~/components/push';
import { push as copy } from '~/copy/push';
import { showTestNotification } from '~/lib/push';

/**
 * Notifikasi's card for this device (garis/screens-more.js `scrNotif`): Aktif with Kirim notifikasi uji, Belum aktif
 * with Nyalakan notifikasi. The prototype draws only those two; Diblokir, needs the installed app and unsupported
 * are written in the same card (new copy, P1-C report).
 */
export function PushCard({ onInstall }: { onInstall?: () => void }) {
  const { status } = usePushState();

  if (status === null)
    return (
      <Card className="p-4">
        <Skeleton>
          <div className="grid gap-3">
            <SkeletonBar width="70%" />
            <SkeletonBar width="90%" />
          </div>
        </Skeleton>
      </Card>
    );

  if (status === 'aktif')
    return (
      <Card className="grid gap-2.5 p-4">
        <p className="flex items-center gap-2 t-sub">
          <span className="text-success">
            <IconCentang size={20} />
          </span>
          {copy.kartu.aktif}
        </p>
        <Button
          variant="paper"
          size="sm"
          className="justify-self-start"
          onClick={() =>
            showTestNotification().then(
              () => toast.success(copy.toast.ujiTerkirim),
              () => toast.error(copy.toast.ujiGagal),
            )
          }
        >
          {copy.kartu.kirimUji}
        </Button>
      </Card>
    );

  if (status === 'belum')
    return (
      <Card className="grid gap-2 p-4">
        <p className="t-sub">{copy.kartu.belum}</p>
        <p className="t-sm text-fg-2">{copy.kartu.belumIsi}</p>
        <Button
          variant="gold"
          className="justify-self-start"
          onClick={() => void openPushPrompt()}
        >
          <IconLonceng size={16} />
          {copy.kartu.nyalakan}
        </Button>
      </Card>
    );

  const [title, text] =
    status === 'diblokir'
      ? [copy.kartu.diblokir, copy.kartu.diblokirIsi]
      : status === 'perlu-pasang'
        ? [copy.kartu.perluPasang, copy.kartu.perluPasangIsi]
        : [copy.kartu.tidakDidukung, copy.kartu.tidakDidukungIsi];
  return (
    <Card className="grid gap-2 p-4">
      <p
        className={
          status === 'tidak-didukung'
            ? 'flex items-center gap-2 t-sub'
            : 'flex items-center gap-2 t-sub text-danger'
        }
      >
        <IconPeringatan size={20} />
        <span className="text-fg">{title}</span>
      </p>
      <p className="t-sm text-fg-2">{text}</p>
      {status === 'perlu-pasang' && onInstall ? (
        <Button
          variant="paper"
          size="sm"
          className="justify-self-start"
          onClick={onInstall}
        >
          {copy.kartu.pasang}
        </Button>
      ) : null}
    </Card>
  );
}

import { useCallback, useRef, useState } from 'react';
import type { AdminFormResponseItem } from '~/api/generated';
import { Button, Tag, toast } from '~/components/garis';
import { IconKunci } from '~/components/icons/kunci';
import { IconLembar } from '~/components/icons/lembar';
import { IconUnduh } from '~/components/icons/unduh';
import { common } from '~/copy/common';
import { kelola as copy } from '~/copy/kelola';
import { downloadCsv } from '~/lib/csv';
import type { CsvFile } from './csv';
import { rowTime, type Bar } from './rules';
import '~/styles/garis/kelola.css';

/** A response row (`scrLive`'s Pengisi terbaru): NIM, name, major (and angkatan in Rekap Form), time. */
export function ResponseRow({
  response: r,
  withAngkatan = false,
}: {
  response: Pick<
    AdminFormResponseItem,
    'nim' | 'fullName' | 'major' | 'angkatan' | 'submittedAt'
  >;
  withAngkatan?: boolean;
}) {
  return (
    <li className="g-item center g-resp">
      <span className="nim t-label code">{r.nim}</span>
      <span className="name t-sm">{r.fullName}</span>
      <span className="t-cap text-fg-3">{r.major}</span>
      {withAngkatan ? (
        <span className="t-cap text-fg-3 num">{r.angkatan}</span>
      ) : null}
      <span className="t-cap text-fg-3 num">{rowTime(r.submittedAt)}</span>
    </li>
  );
}

/** One question's bars (`.hbars`): the value, a track filled to count / max, and the count. */
export function Bars({
  bars,
  wide = false,
}: {
  bars: readonly Bar[];
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'g-hbars wide' : 'g-hbars'}>
      {bars.map((b) => (
        <div className="g-hbar" key={b.label}>
          <span>{b.label}</span>
          <span className="trk" aria-hidden="true">
            <i style={{ width: `${b.ratio * 100}%` }} />
          </span>
          <span className="v">{b.count}</span>
        </div>
      ))}
    </div>
  );
}

/** A SPARTA submission's status: icon, word and colour. */
export function SpartaStatusTag({ locked }: { locked: boolean }) {
  return locked ? (
    <Tag tone="success" icon={<IconKunci size={16} />}>
      {copy.sparta.terkunci}
    </Tag>
  ) : (
    <Tag icon={<IconLembar size={16} />}>{copy.sparta.draf}</Tag>
  );
}

/**
 * An export: "Mengekspor…" while it runs and never twice at once; the toast when done; a failure gives an error
 * toast that stays until dismissed, with Coba lagi.
 */
export function useCsvExport(
  build: () => Promise<{ file: CsvFile; count: number }>,
  done: (count: number) => string,
) {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const start = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const { file, count } = await build();
      downloadCsv(file.filename, file.content);
      toast.success(done(count));
    } catch {
      toast.error(copy.ekspor.gagal, {
        action: { label: common.actions.cobaLagi, onClick: () => void start() },
      });
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [build, done]);
  return { busy, start };
}

/** The paper Export CSV button (`unduh` icon). */
export function ExportButton({
  busy,
  onClick,
  disabled,
}: {
  busy: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="paper"
      onClick={() => {
        if (!busy) onClick();
      }}
      aria-disabled={busy || undefined}
      disabled={disabled}
    >
      <IconUnduh size={16} />
      {busy ? copy.ekspor.mengekspor : copy.ekspor.tombol}
    </Button>
  );
}

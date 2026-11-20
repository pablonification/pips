import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { ManageForm } from '~/api/generated';
import { Button, FactsList, Modal, toast } from '~/components/garis';
import { IconCentang } from '~/components/icons/centang';
import { IconPeringatan } from '~/components/icons/peringatan';
import { IconProfil } from '~/components/icons/profil';
import { IconUnduh } from '~/components/icons/unduh';
import { fill } from '~/copy/fill';
import { kelolaForm as copy } from '~/copy/kelola-form';
import { angkatanQuery } from '../profil/queries';
import { kindName } from './kinds';
import { CopyButton, LinkBox } from './parts';
import { downloadAnswers } from './queries';
import {
  audienceLabel,
  fieldLabel,
  inFieldOrder,
  publishChecks,
  whenShort,
  type BuilderItem,
  type QuestionKind,
} from './rules';
import { ShareSheetButton } from './ShareDialog';

/** Terbitkan: the checks, when it opens and closes, what goes along from the profile; then publish. */
export function PublishDialog({
  form,
  items,
  open,
  onOpenChange,
  onPublish,
  onSettings,
}: {
  form: ManageForm;
  items: BuilderItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublish: () => Promise<void>;
  onSettings: () => void;
}) {
  const angkatan = useQuery(angkatanQuery());
  const [busy, setBusy] = useState(false);
  const checks = publishChecks(form, items, angkatan.data);
  const ok = checks.every((c) => c.ok);
  const fields = inFieldOrder(form.requestedFields).map(fieldLabel).join(', ');
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={copy.terbitkan.judul}
      footer={
        <>
          {ok ? null : (
            <Button variant="paper" onClick={onSettings}>
              {copy.terbitkan.bukaSetelan}
            </Button>
          )}
          <Button variant="paper" onClick={() => onOpenChange(false)}>
            {copy.terbitkan.batal}
          </Button>
          <Button
            variant="gold"
            aria-disabled={!ok || busy || undefined}
            onClick={async () => {
              if (!ok || busy) return;
              setBusy(true);
              try {
                await onPublish();
              } catch {
                toast.error(copy.terbitkan.gagal);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? copy.terbitkan.menerbitkan : copy.terbitkan.terbitkan}
          </Button>
        </>
      }
    >
      <ul className="fb-checks">
        {checks.map((c, i) => (
          <li key={i} className={c.note ? undefined : c.ok ? 'ok' : 'no'}>
            {c.note ? (
              <IconProfil size={16} />
            ) : c.ok ? (
              <IconCentang size={16} />
            ) : (
              <IconPeringatan size={16} />
            )}
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
      <FactsList
        className="border-t border-line"
        facts={[
          [
            copy.terbitkan.dibuka,
            <span key="o" className="num">
              {form.opensAt
                ? whenShort(form.opensAt)
                : copy.terbitkan.begituDiterbitkan}
            </span>,
          ],
          [
            copy.terbitkan.ditutup,
            <span key="c" className="num">
              {form.closesAt
                ? whenShort(form.closesAt)
                : copy.terbitkan.sampaiDitutup}
            </span>,
          ],
          [copy.terbitkan.dariProfil, fields || copy.profil.tidakAda],
        ]}
      />
    </Modal>
  );
}

/** After Terbitkan: the form is live, so the link is offered at once, "Salin tautan" in focus. */
export function PublishedDialog({
  form,
  open,
  onOpenChange,
  onEditLink,
}: {
  form: ManageForm;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditLink: () => void;
}) {
  const angkatan = useQuery(angkatanQuery());
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  const who = audienceLabel(form.eligibleAngkatan, angkatan.data);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={copy.terbitkan.diterbitkan}
      onOpenAutoFocus={(e) => {
        const el = (
          e.currentTarget as HTMLElement | null
        )?.querySelector<HTMLElement>('.fb-copy');
        if (el) {
          e.preventDefault();
          el.focus();
        }
      }}
      footer={
        <div className="fb-pub-foot">
          <Button variant="paper" onClick={() => onOpenChange(false)}>
            {copy.terbitkan.selesai}
          </Button>
          {canShare ? <ShareSheetButton form={form} /> : null}
          <CopyButton slug={form.slug} variant="gold" size="md" />
        </div>
      }
    >
      <p className="t-sm text-fg-2 num">
        {form.status === 'scheduled' && form.opensAt
          ? fill(copy.terbitkan.bisaMengisiMulai, {
              angkatan: who,
              waktu: whenShort(form.opensAt),
            })
          : fill(copy.terbitkan.bisaMengisi, { angkatan: who })}
      </p>
      <LinkBox slug={form.slug} onEdit={onEditLink} />
    </Modal>
  );
}

/**
 * Before an edit that loses answers on a form that has them: the question quoted, how many have filled the form, and
 * that its answers go from the rekap for good. "Unduh rekap dulu" saves them first. Focus starts on Batal.
 */
export function BreakingDialog({
  formId,
  ask,
  responseCount,
  onCancel,
  onConfirm,
}: {
  formId: string;
  ask: {
    kind: 'del' | 'type';
    label: string;
    number: number;
    from?: QuestionKind;
    to?: QuestionKind;
  } | null;
  responseCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const del = ask?.kind === 'del';
  const to = ask?.to ? kindName(ask.to).toLowerCase() : '';
  const from = ask?.from ? kindName(ask.from).toLowerCase() : '';
  return (
    <Modal
      open={!!ask}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
      small
      role="alertdialog"
      title={
        del
          ? copy.konfirmasi.hapusJudul
          : fill(copy.konfirmasi.ubahJudul, { jenis: to })
      }
      onOpenAutoFocus={(e) => {
        const el = (
          e.currentTarget as HTMLElement | null
        )?.querySelector<HTMLElement>('[data-autofocus]');
        if (el) {
          e.preventDefault();
          el.focus();
        }
      }}
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto"
            aria-disabled={downloading || undefined}
            onClick={async () => {
              if (downloading) return;
              setDownloading(true);
              try {
                await downloadAnswers(formId, 'xlsx');
                toast.success(
                  fill(copy.jawaban.diunduh, { jumlah: responseCount }),
                );
              } catch {
                toast.error(copy.jawaban.gagalUnduh);
              } finally {
                setDownloading(false);
              }
            }}
          >
            <IconUnduh size={16} />
            {downloading ? copy.jawaban.mengunduh : copy.konfirmasi.unduhDulu}
          </Button>
          <Button variant="paper" data-autofocus onClick={onCancel}>
            {copy.konfirmasi.batal}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {del ? copy.konfirmasi.hapusYa : copy.konfirmasi.ubahYa}
          </Button>
        </>
      }
    >
      {ask ? (
        <>
          <div className="fb-quote">
            <span className="fb-n lit" aria-hidden="true">
              {ask.number}
            </span>
            <p className="t-sub">{ask.label || copy.susun.tanpaJudul}</p>
          </div>
          <p className="t-sm text-fg-2">
            <b className="fb-strong">
              {fill(copy.konfirmasi.sudahMengisi, { jumlah: responseCount })}
            </b>{' '}
            {del
              ? copy.konfirmasi.hapusIsi
              : fill(copy.konfirmasi.ubahIsi, { dari: from, ke: to })}
          </p>
        </>
      ) : null}
    </Modal>
  );
}

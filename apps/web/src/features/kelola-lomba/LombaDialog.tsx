/**
 * Tambah lomba and Ubah lomba (a proposal; SPEC stories 113 and 117, FEATURES.md gap 3), for `cnc`. Built only
 * from the prototype's pieces: `addEventForm`'s layout in P0-A's Modal (a sheet on phones), `composeForm`'s
 * checkbox chips for the categories, `.kit-fields` for each date and time. Fields in the card's order. Loaded on
 * demand.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '~/api/client';
import type { Competition } from '~/api/generated';
import {
  Button,
  Chip,
  Chips,
  ErrorState,
  Input,
  Modal,
  Skeleton,
  SkeletonRow,
} from '~/components/garis';
import { IconPeringatan } from '~/components/icons/peringatan';
import { kelolaLomba as t } from '~/copy/kelola-lomba';
import { dayKeyOf } from '~/lib/days';
import '~/features/kelola-tulis/kelola-tulis.css';
import {
  changedFields,
  draftOfLomba,
  firstLombaError,
  lombaBody,
  newLombaDraft,
  validateLomba,
  type LombaDraft,
  type LombaErrors,
  type LombaField,
} from './rules';

export const categoriesQuery = {
  queryKey: ['competition-categories'],
  queryFn: () => api.competitions.getCompetitionCategories(),
};

export interface LombaDialogProps {
  /** Absent: Tambah lomba. */
  competition?: Competition;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onFailed: (error: unknown) => void;
  onCloseAutoFocus?: (e: Event) => void;
}

export default function LombaDialog({
  competition,
  onOpenChange,
  onSaved,
  onFailed,
  onCloseAutoFocus,
}: LombaDialogProps) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<LombaDraft>(() =>
    competition
      ? draftOfLomba(competition)
      : newLombaDraft(dayKeyOf(Date.now())),
  );
  const [errors, setErrors] = useState<LombaErrors>({});
  const categories = useQuery(categoriesQuery);
  const save = useMutation({
    mutationFn: (d: LombaDraft) =>
      competition
        ? api.competitions.updateCompetition({
            id: competition.id,
            requestBody: changedFields(competition, d),
          })
        : api.competitions.createCompetition({ requestBody: lombaBody(d) }),
  });

  const patch = (p: Partial<LombaDraft>) => setDraft((d) => ({ ...d, ...p }));
  const fid = (k: string) => `${id}-${k}`;
  const title = competition ? t.ubahJudul : t.tambah;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (save.isPending) return;
    const found = validateLomba(draft, Date.now());
    setErrors(found);
    const first = firstLombaError(found);
    if (first) {
      requestAnimationFrame(() => document.getElementById(fid(first))?.focus());
      return;
    }
    save.mutate(draft, { onSuccess: onSaved, onError: onFailed });
  };

  const err = (k: LombaField) =>
    errors[k] ? (
      <p className="g-err t-cap" id={fid(`${k}-err`)}>
        <IconPeringatan size={16} />
        {errors[k]}
      </p>
    ) : null;
  const invalid = (k: LombaField) =>
    errors[k]
      ? { 'aria-invalid': true, 'aria-describedby': fid(`${k}-err`) }
      : {};

  const text = (
    k: 'name' | 'organizer' | 'registrationUrl' | 'sourceUrl',
    label: string,
    extra: { type?: string; inputMode?: 'url' } = {},
  ) => (
    <div className="g-fld">
      <label className="t-label" htmlFor={fid(k)}>
        {label}
      </label>
      <Input
        id={fid(k)}
        name={k}
        value={draft[k]}
        autoComplete="off"
        onChange={(e) => patch({ [k]: e.target.value } as Partial<LombaDraft>)}
        {...extra}
        {...invalid(k)}
      />
      {err(k)}
    </div>
  );

  // One date and its time under a visible label; the inputs carry their own names.
  const when = (
    k: 'open' | 'close',
    label: string,
    dateLabel: string,
    timeLabel: string,
  ): ReactNode => {
    const [dk, tk] =
      k === 'open'
        ? (['openDate', 'openTime'] as const)
        : (['closeDate', 'closeTime'] as const);
    return (
      <div className="g-fld" role="group" aria-labelledby={fid(`${k}-l`)}>
        <p className="t-label" id={fid(`${k}-l`)}>
          {label}
        </p>
        <div className="g-kit-fields">
          <Input
            className="num"
            type="date"
            id={fid(k)}
            aria-label={dateLabel}
            value={draft[dk]}
            onChange={(e) =>
              patch({ [dk]: e.target.value } as Partial<LombaDraft>)
            }
            {...invalid(k)}
          />
          <Input
            className="num"
            type="time"
            aria-label={timeLabel}
            value={draft[tk]}
            onChange={(e) =>
              patch({ [tk]: e.target.value } as Partial<LombaDraft>)
            }
            {...invalid(k)}
          />
        </div>
        {err(k)}
      </div>
    );
  };

  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title={title}
      onOpenAutoFocus={(e) => {
        const first = form.current?.querySelector<HTMLElement>('input');
        if (first) {
          e.preventDefault();
          first.focus();
        }
      }}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <form
        ref={form}
        className="g-kelola-form"
        noValidate
        onSubmit={submit}
        aria-label={title}
      >
        {text('name', t.nama)}
        {text('organizer', t.penyelenggara)}
        <div className="g-fld" role="group" aria-labelledby={fid('cat-l')}>
          <p className="t-label" id={fid('cat-l')}>
            {t.kategori}
          </p>
          {categories.data ? (
            <Chips wrap>
              {categories.data.map((c) => (
                <Chip
                  key={c}
                  kind="checkbox"
                  selected={draft.categories.includes(c)}
                  onSelectedChange={(on) =>
                    patch({
                      categories: on
                        ? [...draft.categories, c]
                        : draft.categories.filter((x) => x !== c),
                    })
                  }
                >
                  {c}
                </Chip>
              ))}
            </Chips>
          ) : categories.isError ? (
            <ErrorState
              title={t.kategoriGagal}
              text={t.periksaKoneksi}
              retrying={categories.isFetching}
              onRetry={() => void categories.refetch()}
            />
          ) : (
            <Skeleton label={t.memuatKategori}>
              <SkeletonRow tile={false} lines={['80%']} />
            </Skeleton>
          )}
        </div>
        {when('open', t.dibuka, t.tanggalDibuka, t.jamDibuka)}
        {when('close', t.ditutup, t.tanggalDitutup, t.jamDitutup)}
        <div className="g-fld">
          <label className="t-label" htmlFor={fid('price')}>
            {t.biaya}{' '}
            <span className="font-normal text-fg-3">{t.opsional}</span>
          </label>
          <Input
            className="num"
            id={fid('price')}
            name="price"
            inputMode="numeric"
            autoComplete="off"
            value={draft.price}
            onChange={(e) => patch({ price: e.target.value })}
            {...(errors.price
              ? invalid('price')
              : { 'aria-describedby': fid('price-note') })}
          />
          {errors.price ? (
            err('price')
          ) : (
            <p className="t-cap text-fg-3" id={fid('price-note')}>
              {t.biayaCatatan}
            </p>
          )}
        </div>
        {text('registrationUrl', t.tautanDaftar, {
          type: 'url',
          inputMode: 'url',
        })}
        {text('sourceUrl', t.tautanSumber, { type: 'url', inputMode: 'url' })}
        <div className="g-ov-foot">
          <Button variant="paper" onClick={() => onOpenChange(false)}>
            {t.batal}
          </Button>
          <Button
            variant="gold"
            type="submit"
            aria-disabled={save.isPending || undefined}
          >
            {competition ? t.simpan : t.tambahkan}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

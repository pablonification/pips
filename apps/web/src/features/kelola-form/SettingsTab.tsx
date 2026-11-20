import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type ReactNode } from 'react';
import type { ManageForm, UpdateForm } from '~/api/generated';
import {
  Button,
  ConfirmDialog,
  IconButton,
  LinkButton,
  Switch,
  toast,
} from '~/components/garis';
import { IconCentang } from '~/components/icons/centang';
import { IconHapus } from '~/components/icons/hapus';
import { IconKalender } from '~/components/icons/kalender';
import { IconKunci } from '~/components/icons/kunci';
import { IconLanjut } from '~/components/icons/lanjut';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { kelolaForm as copy } from '~/copy/kelola-form';
import { tanggal } from '~/copy/tanggal';
import { dLong, hm, wib, WIB_OFFSET_MS } from '~/lib/dates';
import { angkatanQuery } from '../profil/queries';
import { deleteForm } from './queries';
import { angkatanChoices, angkatanName } from './rules';

interface Props {
  form: ManageForm;
  save: (body: UpdateForm) => Promise<boolean>;
  before?: ReactNode;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** A WIB day and time as the instant the API stores. */
const wibInstant = (y: number, m: number, d: number, h: number, min: number) =>
  new Date(Date.UTC(y, m, d, h, min) - WIB_OFFSET_MS).toISOString();
const dayKey = (iso: string) => {
  const w = wib(iso);
  return `${w.year}-${pad(w.month + 1)}-${pad(w.day)}`;
};

/**
 * Setelan: who fills the form (angkatan), when it opens and closes (a day on the Kalender's month, opened in place,
 * and a time typed as 09.00), whether a member may change what they sent, the words after sending, "Tutup form
 * sekarang" and "Hapus form". Each change is saved at once.
 */
export function SettingsTab({ form, save, before }: Props) {
  const angkatan = useQuery(angkatanQuery());
  const choices = angkatanChoices(angkatan.data ?? [], form.eligibleAngkatan);
  const navigate = useNavigate();
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(form.thanks ?? copy.setelan.terimaKasih);
  // A tick or a switch shows at once; it goes back if the server refuses it.
  const [years, setYears] = useState(form.eligibleAngkatan);
  const [allowEdit, setAllowEdit] = useState(form.allowEdit);
  useEffect(() => setYears(form.eligibleAngkatan), [form.eligibleAngkatan]);
  useEffect(() => setAllowEdit(form.allowEdit), [form.allowEdit]);

  return (
    <div className="fb-wrap one">
      <div className="fb-canvas" style={{ gap: 0 }}>
        {before ? <div className="mb-4.5">{before}</div> : null}
        <section className="fb-set" aria-labelledby="fb-set-a">
          <h2 className="t-heading" id="fb-set-a">
            {copy.setelan.untukAngkatan}
          </h2>
          <div
            className="fb-ticks"
            role="group"
            aria-labelledby="fb-set-a"
            style={{
              gridTemplateColumns:
                'repeat(auto-fill, minmax(min(200px, 100%), 1fr))',
            }}
          >
            {choices.map((y) => (
              <label key={y} className="fb-tick">
                <input
                  type="checkbox"
                  checked={years.includes(y)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...years, y].sort()
                      : years.filter((x) => x !== y);
                    setYears(next);
                    void save({ eligibleAngkatan: next }).then((ok) => {
                      if (!ok) setYears(form.eligibleAngkatan);
                    });
                  }}
                />
                <span className="fb-key" aria-hidden="true">
                  <i />
                  <IconCentang size={16} />
                </span>
                <span className="l">{angkatanName(y, angkatan.data)}</span>
              </label>
            ))}
          </div>
        </section>
        <section className="fb-set" aria-labelledby="fb-set-j">
          <h2 className="t-heading" id="fb-set-j">
            {copy.setelan.jadwal}
          </h2>
          <div className="fb-two">
            <When
              label={copy.setelan.dibuka}
              timeLabel={copy.setelan.jamDibuka}
              value={form.opensAt}
              fallback={[9, 0]}
              onChange={(v) => save({ opensAt: v })}
            />
            <When
              label={copy.setelan.ditutup}
              timeLabel={copy.setelan.jamDitutup}
              value={form.closesAt}
              fallback={[23, 59]}
              onChange={(v) => save({ closesAt: v })}
              clearable
            />
          </div>
          <p className="t-cap text-fg-3">{copy.setelan.tanpaTutup}</p>
        </section>
        <section className="fb-set" aria-labelledby="fb-set-r">
          <h2 className="t-heading" id="fb-set-r">
            {copy.setelan.jawaban}
          </h2>
          <p className="t-sm text-fg-2">{copy.setelan.satuJawaban}</p>
          <div className="fb-set-row">
            <span className="t-body" id="fb-set-e">
              {copy.setelan.bolehUbah}
            </span>
            <Switch
              checked={allowEdit}
              aria-labelledby="fb-set-e"
              onCheckedChange={(v) => {
                setAllowEdit(v);
                void save({ allowEdit: v }).then((ok) => {
                  if (!ok) setAllowEdit(!v);
                });
              }}
            />
          </div>
        </section>
        <section className="fb-set" aria-labelledby="fb-set-t">
          <h2 className="t-heading" id="fb-set-t">
            {copy.setelan.setelahMengirim}
          </h2>
          <input
            className="fb-lf"
            type="text"
            value={thanks}
            maxLength={200}
            aria-labelledby="fb-set-t"
            autoComplete="off"
            onChange={(e) => setThanks(e.target.value)}
            onBlur={() => {
              const v = thanks.trim();
              if (v !== (form.thanks ?? copy.setelan.terimaKasih))
                void save({ thanks: v || null });
            }}
          />
        </section>
        <section className="fb-set">
          <div className="fb-acts">
            {form.status === 'open' ? (
              <Button variant="paper" onClick={() => setClosing(true)}>
                <IconKunci size={16} />
                {copy.setelan.tutupSekarang}
              </Button>
            ) : null}
            <Button variant="danger-ghost" onClick={() => setDeleting(true)}>
              <IconHapus size={16} />
              {copy.setelan.hapusForm}
            </Button>
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title={copy.setelan.tutupJudul}
        cancelLabel={common.actions.batal}
        confirmLabel={copy.setelan.tutupYa}
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          const ok = await save({ closesAt: new Date().toISOString() });
          setBusy(false);
          if (ok) {
            setClosing(false);
            toast.success(copy.setelan.formDitutup);
          }
        }}
      >
        {copy.setelan.tutupIsi}
      </ConfirmDialog>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={copy.setelan.hapusJudul}
        cancelLabel={common.actions.batal}
        confirmLabel={copy.setelan.hapusYa}
        danger
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteForm(form.id);
            setDeleting(false);
            toast.success(copy.setelan.formDihapus);
            void navigate({ to: '/kelola/form', replace: true });
          } catch {
            toast.error(copy.setelan.gagal);
          } finally {
            setBusy(false);
          }
        }}
      >
        {form.responseCount
          ? fill(copy.setelan.hapusIsi, { jumlah: form.responseCount })
          : copy.setelan.hapusIsiKosong}
      </ConfirmDialog>
    </div>
  );
}

/** A day (the month, opened in place under its line) and a time typed as "09.00". */
function When({
  label,
  timeLabel,
  value,
  fallback,
  onChange,
  clearable = false,
}: {
  label: string;
  timeLabel: string;
  value: string | null;
  fallback: [number, number];
  onChange: (iso: string | null) => Promise<boolean>;
  clearable?: boolean;
}) {
  const id = `fb-when-${label}`;
  const [open, setOpen] = useState<{ y: number; m: number } | null>(null);
  const [time, setTime] = useState(value ? hm(value) : '');
  const [bad, setBad] = useState(false);
  const day = value ? dayKey(value) : '';
  const now = wib(Date.now());
  const toggle = () => {
    if (open) return setOpen(null);
    const w = value ? wib(value) : now;
    setOpen({ y: w.year, m: w.month });
  };
  const pickDay = (y: number, m: number, d: number) => {
    const w = value ? wib(value) : null;
    const [h, min] = w ? [w.hours, w.minutes] : fallback;
    setOpen(null);
    setTime(`${pad(h)}.${pad(min)}`);
    void onChange(wibInstant(y, m, d, h, min));
  };
  const commitTime = () => {
    const m = /^([01]\d|2[0-3])\.([0-5]\d)$/.exec(time);
    if (!value) return;
    if (!m) {
      setBad(true);
      return;
    }
    setBad(false);
    const w = wib(value);
    if (hm(value) !== time)
      void onChange(wibInstant(w.year, w.month, w.day, +m[1]!, +m[2]!));
  };
  return (
    <div className="fb-fld">
      <span className="t-label" id={`${id}-t`}>
        {label}
      </span>
      <div className="fb-dt">
        <button
          type="button"
          className="fb-lf fb-day"
          aria-expanded={!!open}
          aria-labelledby={`${id}-t ${id}-v`}
          onClick={toggle}
          data-when={label}
        >
          <span id={`${id}-v`} className={value ? undefined : 'c3'}>
            {value
              ? `${dLong(value)} ${wib(value).year}`
              : copy.setelan.pilihTanggal}
          </span>
          <IconKalender size={20} />
        </button>
        <input
          className="fb-lf num"
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={time}
          disabled={!value}
          placeholder={`${pad(fallback[0])}.${pad(fallback[1])}`}
          aria-label={timeLabel}
          aria-invalid={bad || undefined}
          aria-describedby={bad ? `${id}-err` : undefined}
          autoComplete="off"
          onChange={(e) => {
            const n = e.target.value.replace(/\D/g, '').slice(0, 4);
            setTime(n.length > 2 ? `${n.slice(0, 2)}.${n.slice(2)}` : n);
          }}
          onBlur={commitTime}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitTime();
          }}
        />
      </div>
      {bad ? (
        <p className="g-err t-cap" id={`${id}-err`}>
          {copy.setelan.jamSalah}
        </p>
      ) : null}
      {open ? (
        <Month
          y={open.y}
          m={open.m}
          chosen={day}
          today={`${now.year}-${pad(now.month + 1)}-${pad(now.day)}`}
          onNav={(dir) => {
            const d = new Date(Date.UTC(open.y, open.m + dir, 1));
            setOpen({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
          }}
          onPick={pickDay}
        />
      ) : null}
      {clearable && value ? (
        <LinkButton
          className="justify-self-start"
          onClick={() => {
            setTime('');
            void onChange(null);
          }}
        >
          {copy.setelan.hapusTanggalTutup}
        </LinkButton>
      ) : null}
    </div>
  );
}

/** The Kalender's month: weeks from Monday, today underlined, the chosen day gold. */
function Month({
  y,
  m,
  chosen,
  today,
  onNav,
  onPick,
}: {
  y: number;
  m: number;
  chosen: string;
  today: string;
  onNav: (dir: -1 | 1) => void;
  onPick: (y: number, m: number, d: number) => void;
}) {
  const first = new Date(Date.UTC(y, m, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = Array.from(
    { length: 42 },
    (_, i) => new Date(Date.UTC(y, m, 1 - lead + i)),
  );
  const weeks = days.slice(35).every((d) => d.getUTCMonth() !== m)
    ? days.slice(0, 35)
    : days;
  const key = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const title = `${tanggal.bulan[m]} ${y}`;
  return (
    <div className="fb-cal">
      <div className="fb-cal-head">
        <p className="t-sub" aria-live="polite">
          {title}
        </p>
        <div className="flex gap-1">
          <IconButton
            label={copy.setelan.bulanSebelumnya}
            onClick={() => onNav(-1)}
          >
            <span className="inline-grid rotate-180">
              <IconLanjut size={20} />
            </span>
          </IconButton>
          <IconButton
            label={copy.setelan.bulanBerikutnya}
            onClick={() => onNav(1)}
          >
            <IconLanjut size={20} />
          </IconButton>
        </div>
      </div>
      <div className="fb-month" role="group" aria-label={title}>
        {[1, 2, 3, 4, 5, 6, 0]
          .map((i) => tanggal.hariPendek[i]!)
          .map((w) => (
            <span key={w} className="wd" aria-hidden="true">
              {w}
            </span>
          ))}
        {weeks.map((d) => {
          const k = key(d);
          return (
            <button
              key={k}
              type="button"
              className={
                [d.getUTCMonth() !== m ? 'out' : '', k === today ? 'today' : '']
                  .join(' ')
                  .trim() || undefined
              }
              aria-pressed={k === chosen}
              aria-label={`${dLong(`${k}T12:00:00+07:00`)} ${d.getUTCFullYear()}`}
              onClick={() =>
                onPick(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
              }
            >
              {d.getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

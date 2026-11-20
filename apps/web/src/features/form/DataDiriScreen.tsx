import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { MyDetails, SavedDetails } from '~/api/generated';
import {
  Button,
  Disclosure,
  ErrorState,
  FactsList,
  LinkButton,
  NoteBox,
  SectionHead,
  toast,
} from '~/components/garis';
import { IconKunci } from '~/components/icons/kunci';
import { IconPeringatan } from '~/components/icons/peringatan';
import { DeskHead, PageBody } from '~/components/shell/page';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { isi } from '~/copy/isi';
import { cn } from '~/lib/utils';
import { DetailEditor } from './DetailEditor';
import { detailProblems, myDetailsQuery, useSaveDetails } from './queries';
import {
  detailToSend,
  draftFromSaved,
  FIELDS,
  fieldText,
  reasonFor,
  reasonOfProblem,
  todayKey,
  type DetailReason,
  type DraftValue,
  type FieldGroup,
  type SavedField,
} from './rules';
import { Loading } from './parts';
import './form.css';

const ID = 'dd';

/**
 * Profil › Data diri: the details a member gives once and forms may request, in groups, each opened in place to
 * fill, change or remove. The account's own facts are folded at the end; they are never typed.
 */
export function DataDiriScreen() {
  const details = useQuery(myDetailsQuery());
  const t = isi.dataDiri;
  let inner;
  if (details.data) inner = <Groups details={details.data} />;
  else if (details.isError)
    inner = (
      <ErrorState
        title={t.gagalMuat}
        onRetry={() => void details.refetch()}
        retrying={details.isFetching}
      />
    );
  else inner = <Loading />;
  return (
    <>
      <DeskHead title={t.judul} />
      {details.data ? inner : <PageBody>{inner}</PageBody>}
    </>
  );
}

function Groups({ details }: { details: MyDetails }) {
  const t = isi.dataDiri;
  const [edit, setEdit] = useState<SavedField | null>(null);
  const [draft, setDraft] = useState<DraftValue | null>(null);
  const [bad, setBad] = useState<DetailReason | null>(null);
  const [said, setSaid] = useState('');
  const saver = useSaveDetails();
  const today = todayKey(Date.now());

  const focusRow = (k: SavedField) =>
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-dd-key="${k}"]`)?.focus(),
    );
  const focusEditor = (k: SavedField) =>
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          `[data-pfrow="${k}"] :is(input, textarea, button)`,
        )
        ?.focus(),
    );
  const open = (k: SavedField) => {
    setEdit(k);
    setDraft(draftFromSaved(k, details.saved));
    setBad(null);
    focusEditor(k);
  };
  const close = (k: SavedField) => {
    setEdit(null);
    setDraft(null);
    setBad(null);
    focusRow(k);
  };
  const save = async () => {
    if (!edit || draft === null || saver.pending) return;
    const k = edit;
    const r = detailToSend(k, draft, today);
    if (!r.ok) {
      setBad(r.reason);
      focusEditor(k);
      return;
    }
    try {
      await saver.save({ [k]: r.value });
      setSaid(fill(t.tersimpan, { label: isi.bidang[k] }));
      close(k);
    } catch (e) {
      const problems = detailProblems(e);
      if (problems?.[k]) {
        setBad(reasonOfProblem(k, problems[k]));
        focusEditor(k);
      } else toast.error(t.gagal);
    }
  };
  const remove = async () => {
    if (!edit || saver.pending) return;
    const k = edit;
    const old = details.saved[k];
    try {
      await saver.save({ [k]: null });
      close(k);
      toast.success(fill(t.dihapus, { label: isi.bidang[k] }), {
        action: {
          label: common.komponen.urungkan,
          onClick: () =>
            void saver
              .save({ [k]: old } as Partial<SavedDetails>)
              .catch(() => toast.error(t.gagal)),
        },
      });
    } catch {
      toast.error(t.gagal);
    }
  };

  const row = (k: SavedField) => {
    const cur = fieldText(k, details);
    const rid = `${ID}-${k}`;
    const label = isi.bidang[k];
    if (edit !== k)
      return (
        <div key={k} className="slip-row">
          <dt id={`${rid}-l`}>{label}</dt>
          <dd>
            <span className={cur ? undefined : 'none'}>
              {cur || t.belumDiisi}
            </span>
            <LinkButton
              data-dd-key={k}
              aria-label={fill(cur ? t.ubahLabel : t.isiLabel, { label })}
              onClick={() => open(k)}
            >
              {cur ? t.ubah : t.isi}
            </LinkButton>
          </dd>
        </div>
      );
    return (
      <div key={k} className="slip-row open">
        <dt id={`${rid}-l`}>{label}</dt>
        <dd>
          <div className={cn('fill', bad && 'is-bad')} data-pfrow={k}>
            <DetailEditor
              field={k}
              value={draft ?? draftFromSaved(k, details.saved)}
              onChange={(v) => {
                setDraft(v);
                setBad(null);
              }}
              idp={rid}
              labelledBy={`${rid}-l`}
              describedBy={`${rid}-err`}
              invalid={!!bad}
              onEnter={() => void save()}
            />
            <div className="fq-err">
              <p id={`${rid}-err`}>
                <IconPeringatan size={16} />
                <span>{isi.alasan[bad ?? reasonFor(k)]}</span>
              </p>
            </div>
            <div className="dd-acts">
              <Button variant="gold" size="sm" onClick={() => void save()}>
                {saver.pending ? t.menyimpan : t.simpan}
              </Button>
              <Button variant="paper" size="sm" onClick={() => close(k)}>
                {t.batal}
              </Button>
              {cur ? (
                <>
                  <span className="grow" />
                  <Button
                    variant="danger-ghost"
                    size="sm"
                    onClick={() => void remove()}
                  >
                    {t.hapus}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </dd>
      </div>
    );
  };

  const group = (g: FieldGroup) => (
    <section key={g} aria-labelledby={`${ID}-g-${g}`}>
      <SectionHead line level={2} id={`${ID}-g-${g}`} title={isi.grup[g]} />
      <dl className="dd-list">
        {FIELDS.filter((f) => f.group === g).map((f) =>
          row(f.key as SavedField),
        )}
      </dl>
    </section>
  );
  const note = (
    <NoteBox icon={<IconKunci size={20} />}>
      <b className="font-semibold text-fg">{t.catatanJudul}</b> {t.catatan}
    </NoteBox>
  );
  const akun = (
    <Disclosure label={t.dariAkun}>
      <FactsList
        facts={FIELDS.filter((f) => f.group === 'akun').map((f) => [
          isi.bidang[f.key],
          <span key={f.key} className="num">
            {fieldText(f.key, details)}
          </span>,
        ])}
      />
      <p className="t-cap text-fg-3">{t.dariAkunIsi}</p>
    </Disclosure>
  );
  const live = (
    <p className="sr-only" role="status">
      {said}
    </p>
  );
  return (
    <PageBody wide className="dd-page dd-desk g-fx">
      {live}
      <div className="dd-note">{note}</div>
      <div className="dd-col">
        {group('kontak')}
        {group('alamat')}
      </div>
      <div className="dd-col">
        {group('darurat')}
        {group('dokumen')}
        {akun}
      </div>
    </PageBody>
  );
}

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type ReactNode } from 'react';
import type { FormSummary, ManageForm } from '~/api/generated';
import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  Menu,
  MenuItem,
  Seg,
  Skeleton,
  SkeletonBlock,
  toast,
} from '~/components/garis';
import { IconLainnya } from '~/components/icons/lainnya';
import { IconLanjut } from '~/components/icons/lanjut';
import { IconLembar } from '~/components/icons/lembar';
import { IconUnduh } from '~/components/icons/unduh';
import { ME_QUERY_KEY } from '~/api/constants';
import { fill } from '~/copy/fill';
import { kelolaForm as copy } from '~/copy/kelola-form';
import { dFull } from '~/lib/dates';
import { fileHref, MEDIA_BASE } from '~/lib/file-link';
import { angkatanQuery } from '../profil/queries';
import { openLiveSocket } from '../kelola/live-socket';
import { KindIcon, kindName } from './kinds';
import {
  answerAtQuery,
  downloadAnswers,
  manageKeys,
  summaryQuery,
} from './queries';
import {
  answerWords,
  audienceLabel,
  fieldLabel,
  fileName,
  inFieldOrder,
  percentOf,
  toItems,
  questionsOf,
} from './rules';

/**
 * Jawaban, as Google Forms has it: how many have filled the form against its audience, live; a summary per question
 * (bars for choices and scales, the text answers, files as links); the responses one by one with only the profile
 * fields the member agreed to send and when it was sent; and the answers as an Excel file (CSV as a second choice).
 */
export function AnswersTab({
  form,
  view,
  at,
  before,
}: {
  form: ManageForm;
  view: 'ringkasan' | 'satu';
  at: number;
  before?: ReactNode;
}) {
  const navigate = useNavigate();
  const angkatan = useQuery(angkatanQuery());
  const summary = useQuery({
    ...summaryQuery(form.id),
    enabled: !!form.publishedAt,
  });
  const [downloading, setDownloading] = useState(false);
  useAnswersLive(form.id, !!form.publishedAt);

  if (!form.publishedAt)
    return (
      <div className="fb-wrap one">
        <div className="fb-canvas">
          {before}
          <EmptyState
            title={copy.jawaban.belumAda}
            text={copy.jawaban.belumAdaIsi}
          />
        </div>
      </div>
    );

  const total = summary.data?.total ?? form.responseCount;
  const audience = summary.data?.audience ?? form.audience;
  const pct = percentOf(total, audience);
  const setView = (lihat: 'ringkasan' | 'satu', no?: number) =>
    void navigate({
      to: '/kelola/form/$formId',
      params: { formId: form.id },
      search: {
        tab: 'jawaban',
        ...(lihat === 'satu' ? { lihat: 'satu' as const, no } : {}),
      },
      replace: true,
    });
  const download = async (format: 'xlsx' | 'csv') => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadAnswers(form.id, format);
      toast.success(fill(copy.jawaban.diunduh, { jumlah: total }));
    } catch {
      toast.error(copy.jawaban.gagalUnduh);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fb-wrap one">
      <div className="fb-canvas">
        {before}
        <div className="fb-ans-head">
          <p>
            <span className="t-figure-xl" data-total="">
              {total}
            </span>
          </p>
          <p className="t-sm text-fg-2 num">
            {fill(copy.jawaban.dari, {
              jumlah: audience,
              angkatan: audienceLabel(
                form.eligibleAngkatan,
                angkatan.data,
                true,
              ),
            })}
          </p>
          <div
            className="fb-meter"
            role="img"
            aria-label={fill(copy.jawaban.persen, { persen: pct })}
          >
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="fb-ans-tools">
          <Seg
            label={copy.jawaban.tampilan}
            value={view}
            onChange={(v) => setView(v, at)}
            options={[
              { value: 'ringkasan', label: copy.jawaban.ringkasan },
              { value: 'satu', label: copy.jawaban.satuPerSatu },
            ]}
          />
          {total ? (
            <span className="dl">
              <Button
                variant="paper"
                size="sm"
                aria-disabled={downloading || undefined}
                onClick={() => void download('xlsx')}
              >
                <IconUnduh size={16} />
                {downloading ? copy.jawaban.mengunduh : copy.jawaban.unduhExcel}
              </Button>
              <Menu
                trigger={
                  <IconButton size="sm" label={copy.jawaban.unduhLain}>
                    <IconLainnya size={20} />
                  </IconButton>
                }
              >
                <MenuItem
                  icon={<IconLembar size={20} />}
                  onSelect={() => void download('csv')}
                >
                  {copy.jawaban.unduhCsv}
                </MenuItem>
              </Menu>
            </span>
          ) : null}
        </div>
        {summary.isPending ? (
          <Skeleton label={copy.jawaban.memuat}>
            <SkeletonBlock height={120} />
            <SkeletonBlock height={120} />
          </Skeleton>
        ) : summary.isError ? (
          <ErrorState
            title={copy.jawaban.gagal}
            onRetry={() => void summary.refetch()}
            retrying={summary.isFetching}
          />
        ) : !total ? (
          <EmptyState title={copy.jawaban.belumMasuk} />
        ) : view === 'satu' ? (
          <OneByOne
            form={form}
            at={Math.min(at, total)}
            total={total}
            onAt={(no) => setView('satu', no)}
          />
        ) : (
          <Summary summary={summary.data} />
        )}
      </div>
    </div>
  );
}

function Summary({ summary }: { summary: FormSummary }) {
  return (
    <div>
      {summary.questions.map((q, i) => (
        <section
          key={q.questionId}
          className="fb-sum"
          aria-labelledby={`fb-sum-${q.questionId}`}
        >
          <div className="fb-sum-head">
            <span className="fb-n" aria-hidden="true">
              {i + 1}
            </span>
            <h2 className="t-sub" id={`fb-sum-${q.questionId}`}>
              {q.label}
            </h2>
            <span className="fb-meta">
              <span className="inline-flex items-center gap-1">
                <KindIcon kind={q.type} size={16} />
                {kindName(q.type)}
              </span>
              <span className="sep" aria-hidden="true">
                ·
              </span>
              {fill(copy.jawaban.dijawab, { jumlah: q.answered })}
              {q.average !== undefined && q.average !== null ? (
                <>
                  <span className="sep" aria-hidden="true">
                    ·
                  </span>
                  {fill(copy.jawaban.rataRata, {
                    nilai: q.average.toFixed(1).replace('.', ','),
                  })}
                </>
              ) : null}
            </span>
          </div>
          {q.counts?.length ? (
            <ul className="fb-bars">
              {q.counts.map((c) => {
                const label =
                  c.value === '__other'
                    ? copy.jawaban.lainnya
                    : answerWords(q.type, c.value, undefined, undefined);
                const pct = percentOf(c.count, q.answered);
                return (
                  <li key={c.value} className="fb-bar-row">
                    <span className="l">{label}</span>
                    <span className="trk" aria-hidden="true">
                      <i style={{ width: `${pct}%` }} />
                    </span>
                    <span className="v">
                      {c.count} ({pct}%)
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {q.texts?.length ? (
            <ul className="fb-texts" aria-label={copy.jawaban.jawabanTeks}>
              {q.texts.map((t, j) => (
                <li key={j}>{t}</li>
              ))}
            </ul>
          ) : null}
          {q.files?.length ? (
            <ul className="fb-texts">
              {q.files.map((f) => {
                const href = fileHref(f.url, MEDIA_BASE);
                return (
                  <li key={f.url}>
                    {href ? (
                      <a
                        className="g-link"
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {f.name}
                      </a>
                    ) : (
                      f.name
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {(q.texts?.length ?? 0) >= 100 || (q.files?.length ?? 0) >= 100 ? (
            <p className="t-cap text-fg-3">{copy.jawaban.lebih}</p>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function OneByOne({
  form,
  at,
  total,
  onAt,
}: {
  form: ManageForm;
  at: number;
  total: number;
  onAt: (no: number) => void;
}) {
  const page = Math.max(1, at);
  const answer = useQuery({
    ...answerAtQuery(form.id, page),
    placeholderData: keepPreviousData,
  });
  const qs = questionsOf(toItems(form.sections));
  const r = answer.data?.responses[0];
  return (
    <div className="fb-one">
      <div className="fb-pager">
        <IconButton
          label={copy.jawaban.sebelumnya}
          aria-disabled={page <= 1 || undefined}
          onClick={() => page > 1 && onAt(page - 1)}
        >
          <span className="inline-grid rotate-180">
            <IconLanjut size={20} />
          </span>
        </IconButton>
        <p className="t-sub num" aria-live="polite">
          {fill(copy.jawaban.jawabanKe, { nomor: page, jumlah: total })}
        </p>
        <IconButton
          label={copy.jawaban.berikutnya}
          aria-disabled={page >= total || undefined}
          onClick={() => page < total && onAt(page + 1)}
        >
          <IconLanjut size={20} />
        </IconButton>
      </div>
      {answer.isPending ? (
        <Skeleton label={copy.jawaban.memuat}>
          <SkeletonBlock height={200} />
        </Skeleton>
      ) : answer.isError || !r ? (
        <ErrorState
          title={copy.jawaban.gagal}
          onRetry={() => void answer.refetch()}
          retrying={answer.isFetching}
        />
      ) : (
        <>
          <p className="t-cap text-fg-2 num">
            {fill(copy.jawaban.dikirim, { waktu: dFull(r.submittedAt) })}
            {r.updatedAt
              ? ` · ${fill(copy.jawaban.diubah, { waktu: dFull(r.updatedAt) })}`
              : ''}
          </p>
          {Object.keys(r.profile).length ? (
            <section className="fb-slip" aria-labelledby="fb-one-pf">
              <h2 className="pt-3 t-label text-fg-2" id="fb-one-pf">
                {copy.jawaban.dataProfil}
              </h2>
              <dl className="fb-dl">
                {inFieldOrder(Object.keys(r.profile) as never).map((k) => (
                  <div key={k}>
                    <dt>{fieldLabel(k)}</dt>
                    <dd>{(r.profile as Record<string, string>)[k]}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
          <dl className="fb-dl">
            {qs.map((q) => {
              const a = r.answers.find((x) => x.questionId === q.id);
              if (!a && q.dependsOn) return null;
              const href =
                a && q.type === 'file' && typeof a.answer === 'string'
                  ? fileHref(a.answer, MEDIA_BASE)
                  : null;
              return (
                <div key={q.id}>
                  <dt>{q.label}</dt>
                  {a ? (
                    <dd>
                      {href ? (
                        <a
                          className="g-link"
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {fileName(a.answer as string)}
                        </a>
                      ) : (
                        answerWords(
                          q.type,
                          a.answer,
                          a.other,
                          q.type === 'rating' ? q.scale.max : undefined,
                        )
                      )}
                    </dd>
                  ) : (
                    <dd className="none">{copy.jawaban.tidakDiisi}</dd>
                  )}
                </div>
              );
            })}
          </dl>
        </>
      )}
    </div>
  );
}

/**
 * The count stays live: the form's socket room (owner, those it is shared with, admin) says when an answer comes in,
 * and the summary, the responses and the form's count are read again.
 */
function useAnswersLive(formId: string, enabled: boolean) {
  const client = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      void client.invalidateQueries({ queryKey: manageKeys.summary(formId) });
      void client.invalidateQueries({
        queryKey: [...manageKeys.form(formId), 'answers'],
      });
      void client.invalidateQueries({
        queryKey: manageKeys.form(formId),
        exact: true,
      });
    };
    return openLiveSocket(
      () =>
        import('socket.io-client').then(({ io }) =>
          io(import.meta.env.VITE_API_URL || window.location.origin, {
            auth: { formAdminId: formId },
            withCredentials: true,
          }),
        ),
      {
        onStatus: () => {},
        onReconnect: refresh,
        events: { 'form:new-response': refresh },
        checkSession: () =>
          client
            .invalidateQueries({ queryKey: [ME_QUERY_KEY] })
            .then(() => !!client.getQueryData([ME_QUERY_KEY])),
      },
    );
  }, [formId, enabled, client]);
}

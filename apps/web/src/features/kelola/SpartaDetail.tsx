import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ApiError } from '~/api/generated';
import { spartaDepartmentsQuery } from '~/components/form/sparta-data';
import {
  Button,
  EmptyState,
  ErrorState,
  FactsList,
  SectionHead,
  Skeleton,
  SkeletonBar,
  SkeletonBlock,
} from '~/components/garis';
import { IconLuar } from '~/components/icons/luar';
import { DeskHead, PageBody, usePageTitle } from '~/components/shell/page';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { kelola as copy } from '~/copy/kelola';
import { useRoleLoss } from './KelolaGate';
import { SpartaStatusTag } from './parts';
import { spartaSubmissionByIdQuery } from './queries';
import { choicesInOrder, orDash } from './rules';

const p = copy.pendaftar;

/**
 * One SPARTA submission (/kelola/sparta/$submissionId; no locked screen): the name as the title, "{NIM} · {jurusan} ·
 * {kelas}" and the status, ID LINE, experience and activities, then a card per choice in priority order with the
 * division's questions and answers. A partial draft shows what it has; "–" for an empty answer.
 */
export function SpartaDetail({ submissionId }: { submissionId: string }) {
  const sub = useQuery(spartaSubmissionByIdQuery(submissionId));
  const departments = useQuery(spartaDepartmentsQuery());
  useRoleLoss(sub.error);
  usePageTitle(sub.data?.fullName);

  const missing = sub.error instanceof ApiError && sub.error.status === 404;
  if (missing)
    return (
      <PageBody>
        <EmptyState
          title={p.tidakDitemukan}
          text={p.tidakDitemukanIsi}
          action={
            <Button variant="paper" size="sm" asChild>
              <Link to="/kelola/sparta">{p.kembali}</Link>
            </Button>
          }
        />
      </PageBody>
    );
  if (sub.isError || departments.isError)
    return (
      <PageBody>
        <ErrorState
          title={p.gagal}
          onRetry={() => {
            if (sub.isError) void sub.refetch();
            if (departments.isError) void departments.refetch();
          }}
          retrying={sub.isFetching || departments.isFetching}
        />
      </PageBody>
    );
  if (sub.isPending || departments.isPending)
    return (
      <PageBody>
        <Skeleton label={p.memuat}>
          <SkeletonBar width="50%" height={28} />
          <SkeletonBar width="70%" />
          <SkeletonBlock height={160} />
        </Skeleton>
      </PageBody>
    );

  const s = sub.data;
  const find = (divisionId: string) => {
    for (const dept of departments.data) {
      const division = dept.divisions?.find((d) => d.id === divisionId);
      if (division) return { division, department: dept };
    }
    return null;
  };

  return (
    <>
      <DeskHead title={s.fullName} />
      <PageBody className="gap-[22px]">
        <div className="grid justify-items-start gap-2">
          <p className="t-body text-fg-2">
            {fill(p.ringkas, {
              nim: s.nim,
              jurusan: orDash(s.jurusan),
              kelas: orDash(s.kelas),
            })}
          </p>
          <SpartaStatusTag locked={s.isLocked} />
        </div>

        <FactsList
          facts={[
            [p.idLine, orDash(s.idLine)],
            [
              p.pengalaman,
              <span className="g-pre" key="p">
                {orDash(s.pengalamanOrganisasi)}
              </span>,
            ],
            [
              p.kesibukan,
              s.kesibukan.length ? (
                <span className="grid gap-1" key="k">
                  {s.kesibukan.map((k, i) => (
                    <span key={i}>
                      {fill(p.kesibukanBaris, {
                        jabatan: k.jabatan,
                        organisasi: k.organisasi,
                        periode: k.periode,
                      })}
                    </span>
                  ))}
                </span>
              ) : (
                copy.sparta.kosongTanda
              ),
            ],
          ]}
        />

        <div className="grid gap-3">
          <SectionHead title={p.pilihanDivisi} />
          {choicesInOrder(s).map((choice) => {
            const found = find(choice.divisionId);
            return (
              <section className="g-choice-card" key={choice.id}>
                <div>
                  <h3 className="t-sub">
                    {fill(p.prioritas, {
                      nomor: choice.priorityOrder,
                      divisi: found?.division.name ?? p.divisiHilang,
                    })}
                  </h3>
                  {found ? (
                    <p className="t-cap text-fg-3">{found.department.name}</p>
                  ) : null}
                </div>
                {found?.division.questions.length ? (
                  <dl>
                    {found.division.questions.map((q) => {
                      const answer = choice.answers.find(
                        (a) => a.questionId === q.id,
                      )?.answer;
                      return (
                        <div key={q.id} className="grid gap-1">
                          <dt className="t-label">{q.label}</dt>
                          <dd className="g-pre t-sm text-fg-2">
                            {q.type === 'file' && answer ? (
                              <a
                                className="g-link in-text"
                                href={answer}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {p.lihatFile}
                                <IconLuar size={16} />
                                <span className="sr-only">
                                  {' '}
                                  {common.shell.situsLuar}
                                </span>
                              </a>
                            ) : (
                              orDash(answer)
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                ) : null}
              </section>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}

import type { ReactNode } from 'react';
import type { ManageForm } from '~/api/generated';
import { SectionHead } from '~/components/garis';
import { PageTitle } from '~/components/shell/page';
import { fill } from '~/copy/fill';
import { kelolaForm as copy } from '~/copy/kelola-form';
import { QuestionSummary } from './QuestionsTab';
import { fieldLabel, inFieldOrder, toItems } from './rules';

/** Pertanyaan for "Lihat jawaban": the form as it is, with nothing to change. */
export function ReadOnlyQuestions({
  form,
  before,
}: {
  form: ManageForm;
  before?: ReactNode;
}) {
  const items = toItems(form.sections);
  const sections = items.filter((x) => x.kind === 'section').length;
  const fields = inFieldOrder(form.requestedFields);
  let n = 0;
  let sn = 0;
  return (
    <div className="fb-wrap one">
      <div className="fb-canvas">
        {before}
        <div className="fb-head">
          <PageTitle display={false} className="fb-title">
            {form.title.trim() || copy.daftar.tanpaJudul}
          </PageTitle>
          {form.description ? (
            <p className="fb-desc">{form.description}</p>
          ) : null}
        </div>
        <div className="fb-items">
          {items.map((it, i) => {
            if (it.kind === 'section') {
              sn++;
              return i === 0 && sections === 1 && !it.title ? null : (
                <SectionHead
                  key={it.id}
                  line
                  title={it.title || fill(copy.susun.bagianN, { nomor: sn })}
                />
              );
            }
            n++;
            return (
              <div key={it.id} className="fb-q ro">
                <span className="fb-n" aria-hidden="true">
                  {n}
                </span>
                <div className="fb-q-main">
                  <QuestionSummary q={it} items={items} withOptions />
                </div>
              </div>
            );
          })}
        </div>
        <section className="fb-fields" aria-labelledby="fb-fields-t">
          <h2 className="t-heading" id="fb-fields-t">
            {copy.profil.judul}
          </h2>
          <p className={fields.length ? 't-body' : 't-body text-fg-2'}>
            {fields.length
              ? fields.map(fieldLabel).join(', ')
              : copy.profil.tidakAda}
          </p>
        </section>
      </div>
    </div>
  );
}

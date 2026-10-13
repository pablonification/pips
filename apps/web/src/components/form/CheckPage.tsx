import type { FormSection } from '~/api/generated';
import { Button } from '~/components/garis';
import { fill } from '~/copy/fill';
import { form as copy } from '~/copy/form';
import {
  answerText,
  checkRows,
  ratingParts,
  type Answers,
} from '~/lib/form/rules';

const WORDS = {
  lainnya: copy.periksa.lainnya,
  dariLima: copy.periksa.dariLima,
  kosong: copy.periksa.kosong,
};

/**
 * The check page's list (garis/screens-more.js `reviewPage`): each section with its answers as given ("Lainnya: …",
 * "4 dari 5", "Tidak diisi") and Ubah, which `onEdit` handles; without `onEdit` (a closed form) there is no Ubah.
 */
export function CheckList({
  sections,
  answers,
  onEdit,
  idPrefix,
}: {
  sections: FormSection[];
  answers: Answers;
  onEdit?: (index: number) => void;
  idPrefix: string;
}) {
  return (
    <div className="g-review">
      {sections.map((sec, i) => {
        const headId = `${idPrefix}-rv-${i}`;
        return (
          <section key={sec.id} className="g-rv-sec" aria-labelledby={headId}>
            <div className="g-between">
              <h3 className="t-heading" id={headId}>
                {sec.title}
              </h3>
              {onEdit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={fill(copy.periksa.ubahBagian, {
                    bagian: sec.title,
                  })}
                  onClick={() => onEdit(i)}
                >
                  {copy.periksa.ubah}
                </Button>
              ) : null}
            </div>
            <dl className="g-rv-list">
              {checkRows(sec, answers).map((q) => {
                const a = answerText(q, sec, answers, WORDS);
                return (
                  <div key={q.id}>
                    <dt>
                      {q.type === 'rating'
                        ? ratingParts(q.label, '').label
                        : q.label}
                    </dt>
                    <dd className={a ? undefined : 'none'}>
                      {a || copy.periksa.tidakDiisi}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        );
      })}
    </div>
  );
}

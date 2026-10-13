import { createFileRoute } from '@tanstack/react-router';
import { prefetch } from '~/api/queries';
import { formDetailQuery, myResponseQuery } from '~/components/form/data';
import { FormFill } from '~/components/form/FormFill';

export const Route = createFileRoute('/_app/_left-navbar/layanan/form/$formId')(
  {
    loader: ({ params }) => {
      prefetch(formDetailQuery(params.formId));
      prefetch(myResponseQuery(params.formId));
    },
    component: FormFillRoute,
  },
);

function FormFillRoute() {
  const { formId } = Route.useParams();
  // A new form is a new fill: its state never carries over from another form.
  return <FormFill key={formId} formId={formId} />;
}

import { createFileRoute } from '@tanstack/react-router';
import { prefetch } from '~/api/queries';
import { FormPage } from '~/features/form/FormPage';
import { loadFormIsi } from '~/features/form/load';
import { formQuery, myResponseQuery } from '~/features/form/queries';

export const Route = createFileRoute('/_app/_left-navbar/layanan/form/$formId')(
  {
    loader: ({ params }) => {
      prefetch(formQuery(params.formId));
      prefetch(myResponseQuery(params.formId));
      // Most forms are the builder's: their screen downloads beside the form's data.
      void loadFormIsi();
    },
    component: FormFillRoute,
  },
);

function FormFillRoute() {
  const { formId } = Route.useParams();
  // A new form is a new fill: its state never carries over from another form.
  return <FormPage key={formId} formId={formId} />;
}

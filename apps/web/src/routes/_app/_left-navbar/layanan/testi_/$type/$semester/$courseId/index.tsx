import { createFileRoute } from '@tanstack/react-router';
import { prefetch } from '~/api/queries';
import { TestiCourseScreen } from '~/features/testi/TestiScreens';
import { catalogueQuery, testimoniQuery } from '~/features/testi/queries';
import { testiSearchSchema } from '~/lib/search-params';

export const Route = createFileRoute(
  '/_app/_left-navbar/layanan/testi_/$type/$semester/$courseId/',
)({
  loader: ({ params }) => {
    prefetch(catalogueQuery());
    prefetch(testimoniQuery(params.courseId));
  },
  component: TestiCourseScreen,
  // `page`: the testimonial shown, 1-based as today's links.
  validateSearch: (search) => testiSearchSchema.parse(search),
});

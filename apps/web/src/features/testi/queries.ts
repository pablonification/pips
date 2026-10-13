import { queryOptions } from '@tanstack/react-query';
import { api } from '~/api/client';
import { COURSE_CATALOGUE_QUERY_KEY } from '~/api/constants';

/**
 * The whole course catalogue (active courses, ordered by code), fetched once: the start search, every course list
 * and the course page's header come from it. The same key and shape as Tambah mata kuliah's (P1-C), so the two
 * share one request.
 */
export const catalogueQuery = () =>
  queryOptions({
    queryKey: [COURSE_CATALOGUE_QUERY_KEY, 'semua'],
    queryFn: () => api.course.getlistCourses({}).then((r) => r.courses),
    staleTime: Infinity,
  });

/** A course the catalogue doesn't list (an inactive one, from an old link). A 404 is "not found". */
export const courseQuery = (courseId: string) =>
  queryOptions({
    queryKey: [COURSE_CATALOGUE_QUERY_KEY, 'detail', courseId],
    queryFn: () => api.course.getCourseById({ courseId }),
    staleTime: Infinity,
  });

/** A course's testimonials, in the API's order. Rows count them with the same key, so opening a course is instant. */
export const testimoniQuery = (courseId: string) =>
  queryOptions({
    queryKey: ['testimoni', courseId],
    queryFn: () => api.testimoni.getTestimoniByCourseId({ courseId }),
  });

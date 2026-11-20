import { queryOptions } from '@tanstack/react-query';
import * as api from '~/api/generated/operations';
import type { InternshipSubmission } from '~/api/generated';

// Route loaders import these queries, so this file reaches every page; SPARTA's writes live in sparta-send.ts.
export const SPARTA_KEY = 'internship';

/** SPARTA's window for the signed-in member: open, closed or not open yet, and whether it is for them. */
export const spartaWindowQuery = () =>
  queryOptions({
    queryKey: [SPARTA_KEY, 'window'],
    queryFn: () => api.getInternshipWindow(),
  });

export const spartaDepartmentsQuery = () =>
  queryOptions({
    queryKey: [SPARTA_KEY, 'departments'],
    queryFn: async () => (await api.getInternshipDepartments()).departments,
  });

/** The member's draft or sent choices, or null (the API answers 200 null when there is none). */
export const spartaSubmissionQuery = () =>
  queryOptions({
    queryKey: [SPARTA_KEY, 'my-submission'],
    queryFn: async () =>
      ((await api.getMyInternshipSubmission()) ??
        null) as InternshipSubmission | null,
  });

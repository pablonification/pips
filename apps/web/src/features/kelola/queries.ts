import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { api } from '~/api/client';
import { FORM_QUERY_KEY, ME_QUERY_KEY } from '~/api/constants';
import type {
  AdminFormResponseItem,
  InternshipSubmission,
  UserWithRoles,
} from '~/api/generated';
import {
  kelolaAccess,
  LATEST_COUNT,
  REKAP_PAGE_SIZE,
  type KelolaPage,
} from './rules';

/*
 * Kelola's data (P3-A). Admin data isn't kept on the device (only SPEC's list is persisted), so a reload offline
 * shows the error state. The keys sit under today's `['form', 'admin', …]`, so a write anywhere refreshes them.
 */

/** Active forms, in their `order` (GET /form/admin/list). */
export const adminFormsQuery = () =>
  queryOptions({
    queryKey: [FORM_QUERY_KEY, 'admin', 'list'],
    queryFn: async () => (await api.form.listAllForms()).forms,
  });

/**
 * A form's count. Shared with Beranda's Kelola card (P1-A, `kelolaSummary`), so both show the same number and a
 * live event refreshes both; `useFormLive` can make the card live too (story 38).
 */
export const formResponsesCountKey = (formId: string) =>
  [FORM_QUERY_KEY, 'admin', formId, 'count'] as const;
export const formResponsesCountQuery = (formId: string) =>
  queryOptions({
    queryKey: formResponsesCountKey(formId),
    queryFn: async () =>
      (await api.form.getFormResponsesCount({ formId })).total,
  });

/** The newest five responses (newest first), with each one's major. */
export const latestResponsesQuery = (formId: string) =>
  queryOptions({
    queryKey: [FORM_QUERY_KEY, 'admin', formId, 'responses', 'latest'],
    queryFn: async () =>
      (
        await api.form.listFormResponses({
          formId,
          page: 1,
          limit: LATEST_COUNT,
        })
      ).responses,
  });

/** One page of Rekap Form: 20 responses matching `search` (NIM or name). */
export const responsesPageQuery = (
  formId: string,
  page: number,
  search: string,
) =>
  queryOptions({
    queryKey: [FORM_QUERY_KEY, 'admin', formId, 'responses', { page, search }],
    queryFn: () =>
      api.form.listFormResponses({
        formId,
        page,
        limit: REKAP_PAGE_SIZE,
        search: search || undefined,
      }),
  });

export const formAnalyticsQuery = (formId: string) =>
  queryOptions({
    queryKey: [FORM_QUERY_KEY, 'admin', formId, 'analytics'],
    queryFn: () => api.form.getFormAnalytics({ formId }),
    // The bars refresh when the page loads or refocuses, not on live events (today's behaviour, and `live-sim`'s).
    refetchOnWindowFocus: 'always',
  });

const EXPORT_PAGE_SIZE = 100;

/** Every response matching `search`, 100 a request until a short page (today's `fetchAllFormResponses`). */
export async function fetchAllResponses(
  formId: string,
  search = '',
): Promise<AdminFormResponseItem[]> {
  const all: AdminFormResponseItem[] = [];
  for (let page = 1; ; page++) {
    const { responses } = await api.form.listFormResponses({
      formId,
      page,
      limit: EXPORT_PAGE_SIZE,
      search: search || undefined,
    });
    all.push(...responses);
    if (responses.length < EXPORT_PAGE_SIZE) return all;
  }
}

const SUBMISSIONS_PER_PAGE = 20;

/**
 * Every SPARTA submission, oldest first: offset 0, 20, 40 … until a page shorter than 20. Never `locked` or
 * `divisionId`: the API filters a division after paging (pages come back short), so filtering is on the device.
 */
export const spartaSubmissionsQuery = () =>
  queryOptions({
    queryKey: ['internship', 'admin', 'submissions'],
    queryFn: async () => {
      const all: InternshipSubmission[] = [];
      for (let offset = 0; ; offset += SUBMISSIONS_PER_PAGE) {
        const { submissions } = await api.internship.listInternshipSubmissions({
          offset,
        });
        all.push(...submissions);
        if (submissions.length < SUBMISSIONS_PER_PAGE) return all;
      }
    },
  });

export const spartaSubmissionByIdQuery = (id: string) =>
  queryOptions({
    queryKey: ['internship', 'admin', 'submission', id],
    queryFn: () => api.internship.getInternshipSubmissionById({ id }),
  });

/** For loaders: whether the cached member may open a Kelola page, so no admin request goes out before the guard. */
export function mayLoad(client: QueryClient, page: KelolaPage): boolean {
  const me = client.getQueryData<UserWithRoles | null>([ME_QUERY_KEY]);
  return !!me && kelolaAccess(me, page).allowed;
}

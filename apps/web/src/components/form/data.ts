import { queryOptions } from '@tanstack/react-query';
import * as api from '~/api/generated/operations';
import { FORM_QUERY_KEY } from '~/api/constants';
import type { FormResponse } from '~/api/generated';

// Route loaders import these queries, so this file reaches every page; the form's send lives in send.ts.

/** One form, with the member's status; `sections` stay null until it opens (GET /form/{formId}). */
export const formDetailQuery = (formId: string) =>
  queryOptions({
    queryKey: [FORM_QUERY_KEY, formId],
    queryFn: () => api.getForm({ formId }),
  });

/** The member's response, or null (the API answers 200 null when there is none). */
export const myResponseQuery = (formId: string) =>
  queryOptions({
    queryKey: [FORM_QUERY_KEY, formId, 'my-response'],
    queryFn: async () =>
      ((await api.getMyFormResponse({ formId })) ??
        null) as FormResponse | null,
  });

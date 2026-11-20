/**
 * What the member's side of a form reads: the list, a form and your response, a form's link and Data diri. The
 * route loaders start these, so they stay light; sending and saving are `send.ts`, uploading a file `upload.ts`.
 */
import { queryOptions } from '@tanstack/react-query';
import * as api from '~/api/generated/operations';
import {
  FORM_LINK_QUERY_KEY,
  FORM_QUERY_KEY,
  MY_DETAILS_QUERY_KEY,
} from '~/api/constants';
import { ApiError, type FormResponse } from '~/api/generated';

export { formListQuery } from '~/api/queries';

/** One form with your status; `sections` stay null until it opens or when it isn't for your angkatan. */
export const formQuery = (formId: string) =>
  queryOptions({
    queryKey: [FORM_QUERY_KEY, formId],
    queryFn: () => api.getForm({ formId }),
  });

/** Your response, or null (the API answers 200 null when there is none). */
export const myResponseQuery = (formId: string) =>
  queryOptions({
    queryKey: [FORM_QUERY_KEY, formId, 'my-response'],
    queryFn: async () =>
      ((await api.getMyFormResponse({ formId })) ??
        null) as FormResponse | null,
  });

/** Where `/f/<name>` leads. A 404 is an answer here ("Form tidak ditemukan"), not a failure to retry. */
export const formLinkQuery = (name: string) =>
  queryOptions({
    queryKey: [FORM_LINK_QUERY_KEY, name],
    queryFn: async () => {
      try {
        return await api.openFormLink({ name });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
  });

/** Your account facts and saved details. */
export const myDetailsQuery = () =>
  queryOptions({
    queryKey: [MY_DETAILS_QUERY_KEY],
    queryFn: () => api.getMyDetails(),
  });

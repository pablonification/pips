/**
 * Every request the member's side of a form makes: the list, a form and your response, sending and Ubah jawaban, a
 * form's link and Data diri (uploading a file is `upload.ts`, kept out of the route loaders' way). Screens use only
 * these two.
 */
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '~/api/client';
import {
  FORM_LINK_QUERY_KEY,
  FORM_QUERY_KEY,
  MY_DETAILS_QUERY_KEY,
} from '~/api/constants';
import {
  ApiError,
  type DetailsChange,
  type FormAnswer,
  type FormResponse,
  type MyDetails,
} from '~/api/generated';

export { formListQuery } from '~/api/queries';

/** One form with your status; `sections` stay null until it opens or when it isn't for your angkatan. */
export const formQuery = (formId: string) =>
  queryOptions({
    queryKey: [FORM_QUERY_KEY, formId],
    queryFn: () => api.form.getForm({ formId }),
  });

/** Your response, or null (the API answers 200 null when there is none). */
export const myResponseQuery = (formId: string) =>
  queryOptions({
    queryKey: [FORM_QUERY_KEY, formId, 'my-response'],
    queryFn: async () =>
      ((await api.form.getMyFormResponse({ formId })) ??
        null) as FormResponse | null,
  });

/** Where `/f/<name>` leads. A 404 is an answer here ("Form tidak ditemukan"), not a failure to retry. */
export const formLinkQuery = (name: string) =>
  queryOptions({
    queryKey: [FORM_LINK_QUERY_KEY, name],
    queryFn: async () => {
      try {
        return await api.form.openFormLink({ name });
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
    queryFn: () => api.form.getMyDetails(),
  });

/** How a send ended, for the screen to act on. */
export type SendOutcome =
  | { kind: 'sent'; response: FormResponse }
  | { kind: 'already' } // 409: sent before (another tab, a lost answer)
  | { kind: 'closed' } // 403: closed, not open, or changes no longer allowed
  | { kind: 'missing'; fields: string[] } // 400: requested details still missing
  | { kind: 'problems'; problems: Record<string, string> } // 400: a detail that doesn't fit
  | { kind: 'answers' } // 400: an answer the server refused
  | { kind: 'failed' }; // offline, network or 5xx: keep everything, Coba lagi

function outcomeOf(error: unknown): SendOutcome {
  if (error instanceof ApiError) {
    if (error.status === 409) return { kind: 'already' };
    if (error.status === 403) return { kind: 'closed' };
    if (error.status === 400) {
      const body = (error.body ?? {}) as {
        missing?: string[];
        problems?: Record<string, string>;
      };
      if (body.missing?.length)
        return { kind: 'missing', fields: body.missing };
      if (body.problems && Object.keys(body.problems).length)
        return { kind: 'problems', problems: body.problems };
      return { kind: 'answers' };
    }
  }
  return { kind: 'failed' };
}

export interface SendBody {
  answers: FormAnswer[];
  agreed?: boolean;
  details?: DetailsChange;
}

/**
 * Sends your answers, or replaces them (Ubah jawaban), and says how it ended. The screen acts on the outcome first
 * and only then refreshes (`refresh`), so a refetch can't swap the screen halfway.
 */
export function useSendForm(formId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ change, body }: { change: boolean; body: SendBody }) =>
      change
        ? api.form.changeFormResponse({ formId, requestBody: body })
        : api.form.submitFormResponse({ formId, requestBody: body }),
    // Offline, a send fails at once (and the screen offers Coba lagi) instead of waiting, paused, for the network.
    networkMode: 'always',
  });
  return {
    pending: mutation.isPending,
    send: async (change: boolean, body: SendBody): Promise<SendOutcome> => {
      try {
        const response = await mutation.mutateAsync({ change, body });
        queryClient.setQueryData(myResponseQuery(formId).queryKey, response);
        if (body.details && Object.keys(body.details).length)
          void queryClient.invalidateQueries({
            queryKey: [MY_DETAILS_QUERY_KEY],
          });
        return { kind: 'sent', response };
      } catch (error) {
        return outcomeOf(error);
      }
    },
    refresh: () =>
      queryClient.invalidateQueries({ queryKey: [FORM_QUERY_KEY] }),
  };
}

/** Changes saved details (Data diri). Resolves to the details as saved, or rejects with the API's error. */
export function useSaveDetails() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (change: DetailsChange) =>
      api.form.updateMyDetails({ requestBody: change }),
    networkMode: 'always',
    onSuccess: (details: MyDetails) =>
      queryClient.setQueryData(myDetailsQuery().queryKey, details),
  });
  return { pending: mutation.isPending, save: mutation.mutateAsync };
}

/** The problems the API gave for details (`400 { problems }`), or null. */
export function detailProblems(error: unknown): Record<string, string> | null {
  if (!(error instanceof ApiError) || error.status !== 400) return null;
  const p = (error.body as { problems?: Record<string, string> } | null)
    ?.problems;
  return p && Object.keys(p).length ? p : null;
}

import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { api } from '~/api/client';
import { FORM_QUERY_KEY } from '~/api/constants';
import { ApiError, type FormResponse } from '~/api/generated';
import type { AnswerValue } from '~/lib/form/rules';

/** One form, with the member's status; `sections` stay null until it opens (GET /form/{formId}). */
export const formDetailQuery = (formId: string) =>
  queryOptions({
    queryKey: [FORM_QUERY_KEY, formId],
    queryFn: () => api.form.getForm({ formId }),
  });

/** The member's response, or null (the API answers 200 null when there is none). */
export const myResponseQuery = (formId: string) =>
  queryOptions({
    queryKey: [FORM_QUERY_KEY, formId, 'my-response'],
    queryFn: async () =>
      ((await api.form.getMyFormResponse({ formId })) ??
        null) as FormResponse | null,
  });

/** How a send ended, for the screen to act on (SPEC "Send failures keep everything"). */
export type SendOutcome =
  | 'sent'
  | 'already' // 409: sent before (another tab, a lost answer): the thank-you
  | 'closed' // 403: closed or not open: the closed view
  | 'incomplete' // 400: the server found a missing answer: back to that section
  | 'failed'; // offline, network or 5xx: keep everything, Coba lagi

export function sendOutcome(error: unknown): SendOutcome {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'already';
    if (error.status === 403) return 'closed';
    if (error.status === 400) return 'incomplete';
  }
  return 'failed';
}

/**
 * Sends the answers and says how it ended. The caller acts on the outcome first and only then refreshes the form
 * and the list (`refresh`), so the screen can't swap to another state halfway through (a refetch that already says
 * "already responded" would otherwise unmount it before it cleared the draft and showed the toast).
 */
export function useSendForm(formId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (answers: { questionId: string; answer: AnswerValue }[]) =>
      api.form.submitFormResponse({ formId, requestBody: { answers } }),
    // Offline, a send fails at once (and the screen offers Coba lagi) instead of waiting, paused, for the network.
    networkMode: 'always',
  });
  return {
    pending: mutation.isPending,
    send: async (
      answers: { questionId: string; answer: AnswerValue }[],
    ): Promise<SendOutcome> => {
      try {
        await mutation.mutateAsync(answers);
        return 'sent';
      } catch (error) {
        return sendOutcome(error);
      }
    },
    // The list too (Beranda's row goes), whatever happened: a 409 or 403 changes them as well.
    refresh: () =>
      queryClient.invalidateQueries({ queryKey: [FORM_QUERY_KEY] }),
  };
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Whether the device says it is online. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

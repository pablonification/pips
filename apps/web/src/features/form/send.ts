/**
 * What the member's side of a form writes: sending and Ubah jawaban, and changing Data diri.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FORM_QUERY_KEY, MY_DETAILS_QUERY_KEY } from '~/api/constants';
import {
  ApiError,
  type DetailsChange,
  type FormAnswer,
  type FormResponse,
  type MyDetails,
} from '~/api/generated';
import * as api from '~/api/generated/operations';
import { myDetailsQuery, myResponseQuery } from './queries';

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
        ? api.changeFormResponse({ formId, requestBody: body })
        : api.submitFormResponse({ formId, requestBody: body }),
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
      api.updateMyDetails({ requestBody: change }),
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

import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '~/api/generated/operations';
import { ApiError, type DraftInternshipSubmission } from '~/api/generated';
import { SPARTA_KEY as KEY, spartaSubmissionQuery } from './sparta-data';

type SpartaWriteOutcome =
  | 'ok'
  | 'closed' // 403: outside the window
  | 'locked' // 409: sent before
  | 'invalid' // 400
  | 'failed'; // offline, network or 5xx

function outcomeOf(error: unknown): SpartaWriteOutcome {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'closed';
    if (error.status === 409) return 'locked';
    if (error.status === 400) return 'invalid';
  }
  return 'failed';
}

/** Saving a draft (`PUT`) and sending (`submit`), each saying how it ended; offline they fail at once. */
export function useSpartaWrites() {
  const queryClient = useQueryClient();
  const draft = useMutation({
    mutationFn: (requestBody: DraftInternshipSubmission) =>
      api.upsertMyInternshipSubmission({ requestBody }),
    networkMode: 'always',
  });
  const send = useMutation({
    mutationFn: (requestBody: DraftInternshipSubmission) =>
      api.submitMyInternshipSubmission({ requestBody }),
    networkMode: 'always',
  });
  const run =
    (m: typeof draft) =>
    async (body: DraftInternshipSubmission): Promise<SpartaWriteOutcome> => {
      try {
        const saved = await m.mutateAsync(body);
        queryClient.setQueryData(spartaSubmissionQuery().queryKey, saved);
        return 'ok';
      } catch (error) {
        return outcomeOf(error);
      }
    };
  return {
    saveDraft: run(draft),
    submit: run(send),
    sending: send.isPending,
    refresh: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  };
}

/**
 * Saves a draft as the page goes away (`pagehide`): a `keepalive` request, which the browser finishes after the page
 * is gone. The generated client can't ask for that.
 */
export function saveDraftOnLeave(requestBody: DraftInternshipSubmission) {
  void fetch(
    `${import.meta.env.VITE_API_URL ?? ''}/api/internship/submission`,
    {
      method: 'PUT',
      keepalive: true,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    },
  ).catch(() => {
    // Nothing to tell: the page is gone.
  });
}

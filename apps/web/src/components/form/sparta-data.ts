import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '~/api/client';
import {
  ApiError,
  type DraftInternshipSubmission,
  type InternshipSubmission,
} from '~/api/generated';

const KEY = 'internship';

/** SPARTA's window for the signed-in member: open, closed or not open yet, and whether it is for them. */
export const spartaWindowQuery = () =>
  queryOptions({
    queryKey: [KEY, 'window'],
    queryFn: () => api.internship.getInternshipWindow(),
  });

export const spartaDepartmentsQuery = () =>
  queryOptions({
    queryKey: [KEY, 'departments'],
    queryFn: async () =>
      (await api.internship.getInternshipDepartments()).departments,
  });

/** The member's draft or sent choices, or null (the API answers 200 null when there is none). */
export const spartaSubmissionQuery = () =>
  queryOptions({
    queryKey: [KEY, 'my-submission'],
    queryFn: async () =>
      ((await api.internship.getMyInternshipSubmission()) ??
        null) as InternshipSubmission | null,
  });

export type SpartaWriteOutcome =
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
      api.internship.upsertMyInternshipSubmission({ requestBody }),
    networkMode: 'always',
  });
  const send = useMutation({
    mutationFn: (requestBody: DraftInternshipSubmission) =>
      api.internship.submitMyInternshipSubmission({ requestBody }),
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

/** A file answer: a presigned upload (`POST /media/upload`), as today's screen does; resolves to the file's URL. */
export async function uploadFile(file: File): Promise<string> {
  const presigned = await api.media.createPresignedUrl({
    requestBody: {
      fileName: file.name.split('.')[0],
      fileType: file.name.split('.').at(-1) ?? '',
    },
  });
  const put = await fetch(presigned.presignedUrl, {
    method: 'PUT',
    body: file,
  });
  if (!put.ok) throw new Error(`upload failed: ${put.status}`);
  return presigned.mediaUrl;
}

/*
 * Kelola › Form's data: every request the builder makes is here, so a change to the API client touches one file.
 * Keys sit under `['form', 'manage', …]`, so a member's own form reads (`['form', …]`) refresh with them. Nothing here
 * is kept on the device (only the persisted keys in api/persistence-policy.ts are).
 */
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import * as api from '~/api/generated/operations';
import type { ManageForm, UpdateForm } from '~/api/generated';
import { MANAGE, manageKeys } from './data';

export { manageFormQuery, managedFormsQuery, manageKeys } from './data';

export const createForm = () => api.createForm({ requestBody: {} });

export const updateForm = (formId: string, requestBody: UpdateForm) =>
  api.updateForm({ formId, requestBody });

export const publishForm = (formId: string) => api.publishForm({ formId });

export const deleteForm = (formId: string) => api.deleteForm({ formId });

export const checkSlug = (formId: string, slug: string) =>
  api.checkFormSlug({ formId, slug });

export const renameSlug = (formId: string, slug: string) =>
  api.renameFormSlug({ formId, requestBody: { slug } });

/** Who has access: the owner, then each person in the order they were added. */
export const formAccessQuery = (formId: string) =>
  queryOptions({
    queryKey: manageKeys.access(formId),
    queryFn: () => api.getFormAccess({ formId }),
  });

export const searchPeople = (formId: string, search: string) =>
  api.searchFormAccess({ formId, search });

export const setAccess = (
  formId: string,
  userId: string,
  role: 'view' | 'edit',
) => api.setFormAccess({ formId, userId, requestBody: { role } });

export const removeAccess = (formId: string, userId: string) =>
  api.removeFormAccess({ formId, userId });

/** The Jawaban tab's summary: per question, with the count against the audience. */
export const summaryQuery = (formId: string) =>
  queryOptions({
    queryKey: manageKeys.summary(formId),
    queryFn: () => api.getFormSummary({ formId }),
  });

/** One response (oldest first; `page` is its place, from 1), as "Satu per satu" shows it. */
export const answerAtQuery = (formId: string, page: number) =>
  queryOptions({
    queryKey: manageKeys.answers(formId, page),
    queryFn: () => api.listFormAnswers({ formId, page, limit: 1 }),
  });

const EXPORT_LIMIT_MS = 30_000;

/**
 * The answers as a file to save: Excel by default, CSV on request. Fetched with the session cookie, because the
 * generated client reads a body as text, which would spoil an .xlsx. Returns how the server named it.
 */
export async function downloadAnswers(
  formId: string,
  format: 'xlsx' | 'csv',
): Promise<void> {
  const base = import.meta.env?.VITE_API_URL ?? '';
  const res = await fetch(
    `${base}/api/form/${encodeURIComponent(formId)}/answers/export?format=${format}`,
    { credentials: 'include', signal: AbortSignal.timeout(EXPORT_LIMIT_MS) },
  );
  if (!res.ok) throw new Error(`export ${res.status}`);
  const name =
    /filename="([^"]+)"/.exec(
      res.headers.get('Content-Disposition') ?? '',
    )?.[1] ?? `jawaban.${format}`;
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Puts a saved form into the cache, so every view of it shows what the server kept. */
export function keepForm(client: QueryClient, form: ManageForm) {
  client.setQueryData(manageKeys.form(form.id), form);
  void client.invalidateQueries({ queryKey: [...MANAGE, 'list'] });
}

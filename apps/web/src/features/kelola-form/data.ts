/*
 * What Kelola › Form's route loaders start: the query keys and options for the list and one form, once the cached
 * member may load them. The loaders reach this file through `load.ts`, so it stays out of the entry every page loads.
 */
import { queryOptions } from '@tanstack/react-query';
import { queryClient } from '~/api/client';
import * as api from '~/api/generated/operations';
import { FORM_QUERY_KEY, ME_QUERY_KEY } from '~/api/constants';
import type { UserWithRoles } from '~/api/generated';
import { prefetch } from '~/api/queries';
import { kelolaAccess } from '../kelola/access';

export const MANAGE = [FORM_QUERY_KEY, 'manage'] as const;

export const manageKeys = {
  all: MANAGE,
  list: (scope: 'mine' | 'all') => [...MANAGE, 'list', scope] as const,
  form: (id: string) => [...MANAGE, id] as const,
  access: (id: string) => [...MANAGE, id, 'access'] as const,
  summary: (id: string) => [...MANAGE, id, 'summary'] as const,
  answers: (id: string, page: number) =>
    [...MANAGE, id, 'answers', page] as const,
};

/** Buatanku and Dibagikan ke aku (`mine`), or every form (`all`, admin). Newest change first. */
export const managedFormsQuery = (scope: 'mine' | 'all') =>
  queryOptions({
    queryKey: manageKeys.list(scope),
    queryFn: async () => (await api.listManagedForms({ scope })).forms,
  });

/** One form as the builder sees it, with what the caller may do (`access`). */
export const manageFormQuery = (formId: string) =>
  queryOptions({
    queryKey: manageKeys.form(formId),
    queryFn: () => api.getManagedForm({ formId }),
  });

/** Whether the cached member may open Kelola › Form, so nothing is asked before the gate. */
function mayLoad(): boolean {
  const me = queryClient.getQueryData<UserWithRoles | null>([ME_QUERY_KEY]);
  return !!me && kelolaAccess(me, 'form').allowed;
}

/** The builder's own code, fetched while the form's data loads (the route's loader starts both). */
export const loadBuilder = () => import('./Builder');

/** The loaders: Kelola › Form's list; one form, with the builder's code or the member's form for Pratinjau. */
export function startList() {
  if (mayLoad()) prefetch(managedFormsQuery('mine'));
}
export function startForm(formId: string, code: () => Promise<unknown>) {
  if (!mayLoad()) return;
  prefetch(manageFormQuery(formId));
  void code();
}

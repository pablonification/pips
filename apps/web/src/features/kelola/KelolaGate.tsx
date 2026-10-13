import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';
import { ME_QUERY_KEY } from '~/api/constants';
import { ApiError } from '~/api/generated';
import useSession from '~/hooks/auth/useSession';
import { kelolaAccess, type KelolaPage } from './rules';

/**
 * Shows a Kelola page only to the roles the capability map allows. Anyone else is sent on with `replace`: to the
 * hub when they have another Kelola tool, else to Layanan (`kelolaAccess`). A cached user who lacks the role waits
 * for the session check before being sent away (the role may just have been given). Nothing inside renders, so
 * no admin endpoint is called, until access is allowed.
 */
export function KelolaGate({
  page,
  children,
}: {
  page: KelolaPage;
  children: ReactNode;
}) {
  const me = useSession();
  const navigate = useNavigate();
  const checking = useIsFetching({ queryKey: [ME_QUERY_KEY] }) > 0;
  const access = kelolaAccess(me, page);
  const to = access.allowed ? null : access.to;
  useEffect(() => {
    if (to && !checking) void navigate({ to, replace: true });
  }, [to, checking, navigate]);
  return access.allowed ? children : null;
}

/**
 * The API answers a missing role with 401 (`roleMiddleware`), which never signs anyone out (P0-B). If an admin
 * request gets it while the cached member still has the role, the role was taken away: check the session again,
 * and `KelolaGate` decides from the answer.
 */
export function useRoleLoss(...errors: unknown[]) {
  const queryClient = useQueryClient();
  const lost = errors.some((e) => e instanceof ApiError && e.status === 401);
  useEffect(() => {
    if (lost) void queryClient.refetchQueries({ queryKey: [ME_QUERY_KEY] });
  }, [lost, queryClient]);
}

import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useContext, useEffect, type ReactNode } from 'react';
import { ME_QUERY_KEY } from '~/api/constants';
import { ApiError } from '~/api/generated';
import { SessionCheckedContext } from '~/components/session';
import useSession from '~/hooks/auth/useSession';
import { gateRedirect, kelolaAccess, type KelolaPage } from './rules';

/**
 * Shows a Kelola page only to the roles the capability map allows. Anyone else is sent on with `replace`: to the
 * hub when they have another Kelola tool, else to Layanan (`kelolaAccess`). A cached user who lacks the role waits
 * for the session check to answer in this visit before being sent away (the role may just have been given). Nothing inside renders, so
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
  const access = kelolaAccess(me, page);
  const to = gateRedirect(access, useContext(SessionCheckedContext));
  useEffect(() => {
    if (to) void navigate({ to, replace: true });
  }, [to, navigate]);
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

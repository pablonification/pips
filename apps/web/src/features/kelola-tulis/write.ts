/**
 * P3-B: what every management write does when it fails (SPEC "Session, persistence and resilience"): the dialog
 * stays open with what was typed, and a persistent error toast says what happened (./rules). On "no access" the
 * member's roles are asked for again, so a role taken away hides its actions; nobody is signed out by a write.
 */
import type { QueryClient } from '@tanstack/react-query';
import { ME_QUERY_KEY } from '~/api/constants';
import { toast } from '~/components/garis';
import { writeFailure, writeFailureMessage } from './rules';

export function reportWriteFailure(error: unknown, qc: QueryClient) {
  toast.error(writeFailureMessage(error));
  if (writeFailure(error) === 'tanpaAkses')
    void qc.invalidateQueries({ queryKey: [ME_QUERY_KEY] });
}

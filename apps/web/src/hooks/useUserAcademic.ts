import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api, queryClient } from '~/api/client';

export function useUserAcademic() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['userAcademic'],
    queryFn: () => api.userProfile.getUserAcademic(),
  });

  useEffect(() => {
    if (data) {
      localStorage.setItem('userAcademic', JSON.stringify(data));
    }
  }, [data]);

  return { userAcademic: data, isLoading, error };
}

/**
 * The device's copy (written by today's app), into an empty cache only, and marked out of date so the server's answer
 * replaces it once per visit (the query never goes stale by time). Regression (2026-11-03): it ran on every page
 * change and put the copy back as fresh: the server was never asked, so the semester stayed as saved, and every screen
 * reading it redrew on each page change, which stalled a slow phone at each letter typed in a search kept in the URL.
 */
export function initialLoadUserAcademic() {
  if (queryClient.getQueryData(['userAcademic']) !== undefined) return;
  const data = localStorage.getItem('userAcademic');
  if (data) {
    queryClient.setQueryData(['userAcademic'], JSON.parse(data));
    void queryClient.invalidateQueries({
      queryKey: ['userAcademic'],
      refetchType: 'none',
    });
  }
}

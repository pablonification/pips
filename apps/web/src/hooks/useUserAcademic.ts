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
 * Seeds an empty cache from the device's copy, marked out of date so the server's answer replaces it once per visit
 * (the query never goes stale by time). It must not run over a loaded cache: putting the copy back as fresh on every
 * page change skips the server and redraws every screen that reads it.
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

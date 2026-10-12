import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '~/api/client';
import { clearPersistedQueries } from '~/api/persister';
import { existingPushSubscription } from '~/lib/push';
import { invalidateSession } from '~/lib/session';

export default function useLogout() {
  const queryClient = useQueryClient();
  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Unregister this device's push subscription if it has one; never ask for permission here.
      const subscription = await existingPushSubscription();
      if (subscription) {
        await api.push.logoutPush({
          requestBody: { endpoint: subscription.endpoint },
        });
      }
      await api.auth.logout();
    },
    onSuccess() {
      void clearPersistedQueries();
      invalidateSession(null);
      queryClient.invalidateQueries({ predicate: () => true });
    },
  });

  return {
    logout: logoutMutation.mutate,
    logoutAsync: logoutMutation.mutateAsync,
    isPending: logoutMutation.isPending,
  };
}

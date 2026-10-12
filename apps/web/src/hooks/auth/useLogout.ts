import { useMutation } from '@tanstack/react-query';
import { api } from '~/api/client';
import { existingPushSubscription } from '~/lib/push';
import { forgetMemberOnDevice } from '~/lib/session';

export default function useLogout() {
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
    // Nothing of the member stays on the device; the session provider then sends them to sign-in.
    onSuccess() {
      void forgetMemberOnDevice();
    },
  });

  return {
    logout: logoutMutation.mutate,
    logoutAsync: logoutMutation.mutateAsync,
    isPending: logoutMutation.isPending,
  };
}

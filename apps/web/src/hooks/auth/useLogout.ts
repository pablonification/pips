import { useMutation } from '@tanstack/react-query';
import { api } from '~/api/client';
import { relinkPush, unlinkPushAtLogout } from '~/lib/push';
import { forgetMemberOnDevice, markChosenSignOut } from '~/lib/session';
import { isSignedOutError } from '~/lib/session-policy';

export default function useLogout() {
  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Unregister this device's push subscription if it has one; never ask for permission here. It never fails:
      // when the server can't unlink the device, its subscription ends here.
      const unlinked = await unlinkPushAtLogout();
      try {
        await api.auth.logout();
      } catch (error) {
        // A 401: the session had already ended (expired, or signed out elsewhere), so you are signed out; finish
        // here as after a sign-out, instead of a "Gagal keluar" whose Coba lagi would fail the same way.
        if (isSignedOutError(error)) return;
        // Still signed in: link the device again, so notifications keep coming.
        if (unlinked) await relinkPush();
        throw error;
      }
    },
    // Nothing of the member stays on the device; the session provider then sends them to sign-in.
    onSuccess() {
      markChosenSignOut();
      void forgetMemberOnDevice();
    },
  });

  return {
    logout: logoutMutation.mutate,
    logoutAsync: logoutMutation.mutateAsync,
    isPending: logoutMutation.isPending,
  };
}

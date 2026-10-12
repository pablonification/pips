import { api } from '~/api/client';
import { PushSubscription } from '~/api/generated';

let _subs: PushSubscription | null = null;

/**
 * This device's existing push subscription, without ever asking for permission (no prompt at sign-out;
 * SPEC "Removals"). Null when there is none, or no service worker is registered.
 */
export async function existingPushSubscription() {
  if (
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted' ||
    !('serviceWorker' in navigator)
  ) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

export async function setupNotification() {
  if (typeof Notification !== 'undefined') {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: import.meta.env.VITE_VAPID_KEY,
        });
        const json = subscription.toJSON() as PushSubscription;
        if (
          typeof json.endpoint === 'string' &&
          typeof json.keys === 'object'
        ) {
          api.push.registerPush({
            requestBody: json,
          });
        }
        _subs = json;
        return _subs;
      }
    } catch (e) {
      // no permission
      return null;
    }
  } else {
    // not supported
    return null;
  }
}

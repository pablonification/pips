import { api } from '~/api/client';
import { PushSubscription } from '~/api/generated';
import { push as copy } from '~/copy/push';
import { currentPlatform } from './platform';
import type { PushFacts } from './push-state';

/*
 * This device's web push: reading its state, turning it on (the only place that asks for permission, after a tap in
 * the prompt), registering it again after a sign-in, unlinking it at sign-out and a local test notification.
 * The screens use `usePushState()` and `openPushPrompt()` from `~/components/push`.
 */

/** `Notification`, a service worker container and `PushManager` all exist. */
export function pushSupported() {
  return (
    typeof Notification !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window
  );
}

async function currentRegistration() {
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

/** The service worker once it is active; rejects after `ms` (a build without a service worker never gets one). */
function readyRegistration(ms = 10_000) {
  return new Promise<ServiceWorkerRegistration>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no service worker')), ms);
    navigator.serviceWorker.ready.then(
      (r) => {
        clearTimeout(timer);
        resolve(r);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/**
 * This device's existing push subscription, without ever asking for permission (no prompt at sign-out;
 * SPEC "Removals"). Null when there is none, or no service worker is registered.
 */
export async function existingPushSubscription() {
  if (!pushSupported() || Notification.permission !== 'granted') return null;
  try {
    const registration = await currentRegistration();
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/** Everything `pushStatus()` needs, read without asking anything. */
export async function readPushFacts(): Promise<PushFacts> {
  const platform = currentPlatform();
  if (!pushSupported())
    return { platform, supported: false, permission: null, subscribed: false };
  const permission = Notification.permission;
  const subscribed =
    permission === 'granted' && (await existingPushSubscription()) !== null;
  return { platform, supported: true, permission, subscribed };
}

function subscriptionBody(sub: globalThis.PushSubscription): PushSubscription {
  const json = sub.toJSON();
  if (
    typeof json.endpoint !== 'string' ||
    typeof json.keys?.p256dh !== 'string' ||
    typeof json.keys?.auth !== 'string'
  )
    throw new Error('incomplete push subscription');
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

/** What turning notifications on ended with. A failure to subscribe or register throws instead. */
export type EnableOutcome = 'aktif' | 'diblokir' | 'belum';

/**
 * Asks for permission (unless already granted), subscribes this device with the server's VAPID key and registers
 * it with `POST /api/push/register`. Call only from a tap on Nyalakan.
 */
export async function enablePush(): Promise<EnableOutcome> {
  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
  if (permission === 'denied') return 'diblokir';
  if (permission !== 'granted') return 'belum';
  const registration = await readyRegistration();
  const sub =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: import.meta.env.VITE_VAPID_KEY,
    }));
  try {
    await api.push.registerPush({ requestBody: subscriptionBody(sub) });
  } catch (e) {
    // The server doesn't know this device: don't leave it looking on. Coba lagi subscribes again, without asking.
    await sub.unsubscribe().catch(() => false);
    throw e;
  }
  return 'aktif';
}

/**
 * After a sign-in: a device that already has permission and a subscription is linked to the new session again,
 * without asking anything, so notifications keep arriving (the sign-out confirmation promises they resume).
 */
export async function registerExistingPush() {
  try {
    const sub = await existingPushSubscription();
    if (sub)
      await api.push.registerPush({ requestBody: subscriptionBody(sub) });
  } catch {
    // Best effort: Profil › Notifikasi still offers to turn it on.
  }
}

/**
 * Unlinks this device from the member at sign-out (`PUT /api/push/logout`), when it has a subscription. True when it
 * unlinked one, so a sign-out that then fails can link it again (`registerExistingPush`).
 */
export async function unlinkPushAtLogout(): Promise<boolean> {
  const subscription = await existingPushSubscription();
  if (!subscription) return false;
  await api.push.logoutPush({
    requestBody: { endpoint: subscription.endpoint },
  });
  return true;
}

/**
 * Kirim notifikasi uji: shows a notification through this device's service worker. Local only: the API has no
 * endpoint that sends one (OPEN-QUESTIONS A4).
 */
export async function showTestNotification() {
  const registration = await readyRegistration(5_000);
  await registration.showNotification(copy.uji.judul, {
    body: copy.uji.isi,
    icon: '/push-icon-192x192.png',
    badge: '/push-badge-96x96.png',
    tag: 'pips-uji',
  });
}

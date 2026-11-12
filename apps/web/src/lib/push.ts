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
function pushSupported() {
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
 * This device's existing push subscription, without ever asking for permission (no prompt at sign-out).
 * Null when there is none, or no service worker is registered.
 */
async function existingPushSubscription() {
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
type EnableOutcome = 'aktif' | 'diblokir' | 'belum';

/**
 * How long Nyalakan waits for the browser's push service. Chrome's first subscription on a device can take half a
 * minute, or not answer at all, so waiting without a limit would leave "Menyalakan…" up for good.
 */
const SUBSCRIBE_WAIT_MS = 15_000;

/** The subscription the browser is still working on, so Coba lagi waits for the same one instead of starting another. */
let subscribing: Promise<globalThis.PushSubscription> | null = null;
/** The subscriptions that already register themselves when they arrive late. */
const lateHandled = new WeakSet<Promise<globalThis.PushSubscription>>();

function subscribeOnce(registration: ServiceWorkerRegistration) {
  if (!subscribing) {
    const started = registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: import.meta.env.VITE_VAPID_KEY,
    });
    subscribing = started;
    const clear = () => {
      if (subscribing === started) subscribing = null;
    };
    started.then(clear, clear);
  }
  return subscribing;
}

/** Registers a subscription with the server; when the server can't, the subscription ends so it doesn't look on. */
async function register(sub: globalThis.PushSubscription) {
  try {
    await api.push.registerPush({ requestBody: subscriptionBody(sub) });
  } catch (e) {
    // The server doesn't know this device: don't leave it looking on. Coba lagi subscribes again, without asking.
    await sub.unsubscribe().catch(() => false);
    throw e;
  }
}

/**
 * Subscribes (or joins the subscription already under way), waiting at most `SUBSCRIBE_WAIT_MS`. When the browser's
 * push service hasn't answered by then it throws, and the subscription keeps going: if it arrives later it is
 * registered then, once, and `onLate` runs.
 */
async function subscribeWithin(
  registration: ServiceWorkerRegistration,
  onLate?: () => void,
) {
  const pending = subscribeOnce(registration);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), SUBSCRIBE_WAIT_MS);
  });
  const sub = await Promise.race([pending, slow]).finally(() =>
    clearTimeout(timer),
  );
  if (sub) return sub;
  if (!lateHandled.has(pending)) {
    lateHandled.add(pending);
    pending
      .then(register)
      .then(() => onLate?.())
      .catch(() => undefined);
  }
  throw new Error('push service did not answer');
}

/**
 * Asks for permission (unless already granted), subscribes this device with the server's VAPID key and registers
 * it with `POST /api/push/register`. Call only from a tap on Nyalakan.
 *
 * When the browser's push service hasn't answered after `SUBSCRIBE_WAIT_MS`, it throws (the prompt says it didn't
 * work, with Coba lagi), and the subscription keeps going: if it arrives later it is registered then, once, and
 * `onLate` runs.
 */
export async function enablePush(onLate?: () => void): Promise<EnableOutcome> {
  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
  if (permission === 'denied') return 'diblokir';
  if (permission !== 'granted') return 'belum';
  const registration = await readyRegistration();
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await register(existing);
    return 'aktif';
  }
  await register(await subscribeWithin(registration, onLate));
  return 'aktif';
}

/** Whether this app start has already told the server about this device's subscription. */
let linkedThisStart = false;

/**
 * After a sign-in: a device that already has permission and a subscription is linked to the new session again,
 * without asking anything, so notifications keep arriving (the sign-out confirmation promises they resume).
 */
export async function registerExistingPush() {
  linkedThisStart = true;
  try {
    const sub = await existingPushSubscription();
    if (sub)
      await api.push.registerPush({ requestBody: subscriptionBody(sub) });
  } catch {
    // Best effort: Profil › Notifikasi still offers to turn it on.
  }
}

/**
 * Once per app start, when the server has confirmed the session: the device's existing subscription is registered
 * again (the route is safe to repeat), so a device that looks on is one the server knows. Asks nothing.
 */
export function registerExistingPushOnce() {
  if (linkedThisStart) return;
  void registerExistingPush();
}

/**
 * Unlinks this device from the member at sign-out (`PUT /api/push/logout`), when it has a subscription. True when it
 * unlinked one, so a sign-out that then fails can link it again (`relinkPush`).
 *
 * When the server can't unlink it, the browser's subscription is ended here instead, which also stops this device's
 * notifications, and the sign-out goes on: a failing push endpoint must never keep a member signed in on a shared
 * device.
 */
export async function unlinkPushAtLogout(): Promise<boolean> {
  const subscription = await existingPushSubscription();
  if (!subscription) return false;
  try {
    await api.push.logoutPush({
      requestBody: { endpoint: subscription.endpoint },
    });
  } catch {
    await subscription.unsubscribe().catch(() => false);
  }
  return true;
}

/**
 * After a failed sign-out: links this device again. If the sign-out ended the browser's subscription, it subscribes
 * again without asking (permission is already granted), then registers.
 */
export async function relinkPush() {
  try {
    let sub = await existingPushSubscription();
    if (!sub && Notification.permission === 'granted') {
      // Bounded like Nyalakan: a push service that never answers must not keep "Keluar…" up for good.
      sub = await subscribeWithin(await readyRegistration(5_000));
    }
    if (sub)
      await api.push.registerPush({ requestBody: subscriptionBody(sub) });
  } catch {
    // Best effort: Profil › Notifikasi still offers to turn it on.
  }
}

/**
 * Kirim notifikasi uji: shows a notification through this device's service worker. Local only: the API has no
 * endpoint that sends one.
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

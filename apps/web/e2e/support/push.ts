/**
 * The harness's `push` option (P1-C): this device's notification permission and push subscription.
 *
 * The harness blocks service workers, so the app's push code would never find a registration. An init script
 * stands in for the browser's pieces instead: `Notification` (permission, `requestPermission`),
 * `navigator.serviceWorker.ready` / `getRegistration()` (a registration whose `pushManager` subscribes and whose
 * `showNotification` records what it shows). Everything else on `navigator.serviceWorker` is the real one.
 *
 * - `'off'`: permission `default`, not subscribed (Nadia's default, as in the prototype);
 * - `'on'`: granted and subscribed (Raka's default);
 * - `'blocked'`: denied.
 *
 * The state survives reloads and navigations in the same test (sessionStorage). A journey decides how the browser's
 * own permission prompt is answered with `answerPermission(page, 'denied')` (default: granted), and reads what
 * happened with `pushDevice(page)`.
 */
import type { BrowserContext, Page } from '@playwright/test';

export type PushMode = 'off' | 'on' | 'blocked';

/** The subscription the fake push manager hands out; `POST /api/push/register` should receive exactly this. */
export const E2E_SUBSCRIPTION = {
  endpoint: 'https://push.e2e.invalid/subscription/1',
  keys: { p256dh: 'e2e-p256dh-key', auth: 'e2e-auth-secret' },
} as const;

export interface PushDevice {
  permission: NotificationPermission;
  subscribed: boolean;
  /** How the next `Notification.requestPermission()` is answered. */
  answer: NotificationPermission;
  /** How many times the app asked for permission. */
  asks: number;
  /** The options of each `pushManager.subscribe()` call. */
  subscribes: Array<{ userVisibleOnly: boolean; applicationServerKey: string }>;
  /** Notifications shown through the service worker. */
  shown: Array<{ title: string; body?: string; tag?: string }>;
}

export async function installPushStub(context: BrowserContext, mode: PushMode) {
  await context.addInitScript(
    ({ mode, sub }) => {
      const KEY = 'e2e:push';
      const initial = {
        permission:
          mode === 'on' ? 'granted' : mode === 'blocked' ? 'denied' : 'default',
        subscribed: mode === 'on',
        answer: 'granted',
        asks: 0,
        subscribes: [],
        shown: [],
      };
      const load = () => {
        try {
          const raw = sessionStorage.getItem(KEY);
          if (raw) return JSON.parse(raw);
        } catch {
          // fall through
        }
        return initial;
      };
      const state = load();
      const save = () => sessionStorage.setItem(KEY, JSON.stringify(state));
      save();
      (window as unknown as { __e2ePush: unknown }).__e2ePush = {
        get: () => ({ ...load() }),
        answer: (a: string) => {
          const s = load();
          Object.assign(state, s, { answer: a });
          save();
        },
      };
      const sync = () => Object.assign(state, load());

      const subscription = () => ({
        endpoint: sub.endpoint,
        expirationTime: null,
        options: { userVisibleOnly: true, applicationServerKey: null },
        getKey: () => null,
        toJSON: () => ({
          endpoint: sub.endpoint,
          expirationTime: null,
          keys: { ...sub.keys },
        }),
        unsubscribe: async () => {
          sync();
          state.subscribed = false;
          save();
          return true;
        },
      });

      class FakeNotification {
        static get permission() {
          sync();
          return state.permission;
        }
        static async requestPermission() {
          sync();
          state.asks++;
          // A browser asks only once: after an answer it keeps returning it.
          if (state.permission === 'default') state.permission = state.answer;
          save();
          return state.permission;
        }
        constructor(public title: string) {}
        close() {}
      }
      Object.defineProperty(window, 'Notification', {
        value: FakeNotification,
        configurable: true,
        writable: true,
      });

      const pushManager = {
        getSubscription: async () => {
          sync();
          return state.subscribed ? subscription() : null;
        },
        subscribe: async (opts: {
          userVisibleOnly: boolean;
          applicationServerKey: unknown;
        }) => {
          sync();
          if (state.permission !== 'granted')
            throw new DOMException('Permission denied', 'NotAllowedError');
          state.subscribes.push({
            userVisibleOnly: opts.userVisibleOnly,
            applicationServerKey: String(opts.applicationServerKey),
          });
          state.subscribed = true;
          save();
          return subscription();
        },
        permissionState: async () => {
          sync();
          return state.permission === 'default' ? 'prompt' : state.permission;
        },
      };
      const registration = {
        scope: `${location.origin}/`,
        active: { state: 'activated' },
        pushManager,
        showNotification: async (
          title: string,
          opts: { body?: string; tag?: string } = {},
        ) => {
          sync();
          state.shown.push({ title, body: opts.body, tag: opts.tag });
          save();
        },
        getNotifications: async () => [],
        update: async () => undefined,
        unregister: async () => true,
        addEventListener() {},
        removeEventListener() {},
      };

      const real = navigator.serviceWorker;
      if (!real) return;
      const fake = new Proxy(real, {
        get(target, prop) {
          if (prop === 'ready') return Promise.resolve(registration);
          if (prop === 'getRegistration') return async () => registration;
          if (prop === 'getRegistrations') return async () => [registration];
          const v = Reflect.get(target, prop, target);
          return typeof v === 'function' ? v.bind(target) : v;
        },
      });
      Object.defineProperty(navigator, 'serviceWorker', {
        get: () => fake,
        configurable: true,
      });
    },
    { mode, sub: E2E_SUBSCRIPTION },
  );
}

/** How the browser answers the next permission request (default granted). Set it before the app asks. */
export async function answerPermission(
  page: Page,
  answer: NotificationPermission,
) {
  await page.evaluate(
    (a) =>
      (
        window as unknown as { __e2ePush: { answer: (a: string) => void } }
      ).__e2ePush.answer(a),
    answer,
  );
}

/** This device's push state as the app left it. */
export async function pushDevice(page: Page): Promise<PushDevice> {
  return page.evaluate(() =>
    (
      window as unknown as { __e2ePush: { get: () => PushDevice } }
    ).__e2ePush.get(),
  );
}

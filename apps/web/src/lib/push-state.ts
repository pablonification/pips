import { IOS_PUSH_MIN, type Platform } from './platform';

/**
 * This device's push notification state (SPEC stories 104–106), from permission, subscription and platform:
 * - `aktif`: permission granted and this device subscribed;
 * - `belum`: not yet asked, or asked and dismissed (the prompt can turn it on);
 * - `diblokir`: permission denied; only the browser's site settings can undo it;
 * - `perlu-pasang`: an iPhone or iPad outside the installed app (web push needs iOS 16.4+ and the installed app);
 * - `tidak-didukung`: this browser can't receive web push at all.
 */
export type PushStatus =
  'aktif' | 'belum' | 'diblokir' | 'perlu-pasang' | 'tidak-didukung';

export interface PushFacts {
  platform: Platform;
  /** `Notification`, a service worker container and `PushManager` all exist. */
  supported: boolean;
  permission: NotificationPermission | null;
  subscribed: boolean;
}

export function pushStatus(f: PushFacts): PushStatus {
  const { platform } = f;
  if (platform.ios && !platform.standalone) {
    return platform.iosVersion !== null && platform.iosVersion < IOS_PUSH_MIN
      ? 'tidak-didukung'
      : 'perlu-pasang';
  }
  if (!f.supported || f.permission === null) return 'tidak-didukung';
  if (f.permission === 'denied') return 'diblokir';
  if (f.permission === 'granted' && f.subscribed) return 'aktif';
  return 'belum';
}

/** Whether the prompt's Nyalakan can turn notifications on from here. */
export const canAskForPush = (s: PushStatus) => s === 'belum';

/**
 * What kind of device and browser PIPS! runs in, for push notifications and Pasang PIPS! (SPEC stories 8, 106).
 * Pure: the browser facts come in as arguments, so the rules are unit-tested (tests/push-state.test.ts).
 */

export interface PlatformFacts {
  userAgent: string;
  /** `navigator.platform`: iPadOS 13+ reports MacIntel with touch. */
  platform?: string;
  maxTouchPoints?: number;
  /** Running as the installed app: `display-mode: standalone` or iOS's `navigator.standalone`. */
  standalone: boolean;
}

export interface Platform {
  /** An iPhone or iPad (iOS or iPadOS), whatever the browser: every iOS browser is Safari underneath. */
  ios: boolean;
  /** iOS's major and minor version, e.g. 16.4; null when unknown or not iOS. */
  iosVersion: number | null;
  android: boolean;
  /** LINE's in-app browser, which can't install apps or show notifications. */
  line: boolean;
  /** Chrome on Android (not an in-app browser), the one that offers `beforeinstallprompt`. */
  androidChrome: boolean;
  standalone: boolean;
}

export function detectPlatform(f: PlatformFacts): Platform {
  const ua = f.userAgent;
  const iPadOs = f.platform === 'MacIntel' && (f.maxTouchPoints ?? 0) > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || iPadOs;
  const m = /OS (\d+)[_.](\d+)/.exec(ua);
  const v = /Version\/(\d+)\.(\d+)/.exec(ua);
  const iosVersion = !ios
    ? null
    : m
      ? Number(`${m[1]}.${m[2]}`)
      : v
        ? Number(`${v[1]}.${v[2]}`)
        : null;
  const android = !ios && /Android/i.test(ua);
  const line = /\bLine\//i.test(ua);
  const inApp = line || /FBAN|FBAV|Instagram|; wv\)/i.test(ua);
  const androidChrome =
    android &&
    /Chrome\/\d+/.test(ua) &&
    !/EdgA|OPR|SamsungBrowser/.test(ua) &&
    !inApp;
  return {
    ios,
    iosVersion,
    android,
    line,
    androidChrome,
    standalone: f.standalone,
  };
}

/** The current browser's facts. */
export function currentPlatform(): Platform {
  if (typeof navigator === 'undefined')
    return detectPlatform({ userAgent: '', standalone: false });
  const standalone =
    (typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return detectPlatform({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone,
  });
}

/** Web push on iOS needs iOS 16.4 or later, and only inside the installed app. */
export const IOS_PUSH_MIN = 16.4;

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { detectPlatform, type Platform } from '../src/lib/platform';
import { canAskForPush, pushStatus } from '../src/lib/push-state';

/* Push state (the five states) and the iPhone, LINE and Android detection (P1-C brief, "Rules to unit-test"). */

const UA = {
  iphone17:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphone16_3:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  iphoneLine:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidLine:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Line/14.9.1/IAB',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

const p = (
  userAgent: string,
  more: Partial<Parameters<typeof detectPlatform>[0]> = {},
) => detectPlatform({ userAgent, standalone: false, ...more });

test('an iPhone is iOS with its version, whatever the browser', () => {
  assert.deepEqual(
    [p(UA.iphone17).ios, p(UA.iphone17).iosVersion],
    [true, 17.5],
  );
  assert.equal(p(UA.iphone16_3).iosVersion, 16.3);
  assert.equal(p(UA.iphoneChrome).ios, true);
  assert.equal(p(UA.iphoneChrome).androidChrome, false);
});

test('an iPad on iPadOS 13+ reports a Mac with touch, and counts as iOS', () => {
  assert.equal(
    p(UA.macSafari, { platform: 'MacIntel', maxTouchPoints: 5 }).ios,
    true,
  );
  assert.equal(
    p(UA.macSafari, { platform: 'MacIntel', maxTouchPoints: 0 }).ios,
    false,
  );
});

test("LINE's in-app browser is recognised on iPhone and Android, and isn't Chrome", () => {
  assert.equal(p(UA.iphoneLine).line, true);
  assert.equal(p(UA.androidLine).line, true);
  assert.equal(p(UA.androidLine).androidChrome, false);
  assert.equal(p(UA.androidChrome).line, false);
});

test('Android Chrome is the one that can offer the install prompt; Samsung Internet and desktops are not', () => {
  assert.equal(p(UA.androidChrome).androidChrome, true);
  assert.equal(p(UA.androidChrome).android, true);
  assert.equal(p(UA.androidSamsung).androidChrome, false);
  assert.equal(p(UA.windowsChrome).androidChrome, false);
  assert.equal(p(UA.windowsChrome).android, false);
  assert.equal(p(UA.windowsChrome).ios, false);
});

const desktop: Platform = p(UA.windowsChrome);
const facts = (
  permission: NotificationPermission | null,
  subscribed = false,
  platform = desktop,
  supported = true,
) => ({ platform, permission, subscribed, supported });

test('the five states', () => {
  assert.equal(pushStatus(facts('granted', true)), 'aktif');
  assert.equal(pushStatus(facts('default')), 'belum');
  assert.equal(pushStatus(facts('denied')), 'diblokir');
  assert.equal(
    pushStatus(facts('default', false, p(UA.iphone17))),
    'perlu-pasang',
  );
  assert.equal(
    pushStatus(facts(null, false, desktop, false)),
    'tidak-didukung',
  );
});

test('granted but not subscribed (or unsubscribed since) is still "belum": Nyalakan subscribes without asking', () => {
  assert.equal(pushStatus(facts('granted', false)), 'belum');
  assert.equal(canAskForPush('belum'), true);
  for (const s of [
    'aktif',
    'diblokir',
    'perlu-pasang',
    'tidak-didukung',
  ] as const)
    assert.equal(canAskForPush(s), false, s);
});

test('an iPhone needs the installed app for push; in the installed app it works like any other browser', () => {
  const outside = p(UA.iphone17);
  const installed = p(UA.iphone17, { standalone: true });
  // Safari outside the installed app has no Notification at all: still "perlu-pasang", not "tidak-didukung".
  assert.equal(pushStatus(facts(null, false, outside, false)), 'perlu-pasang');
  assert.equal(pushStatus(facts('default', false, installed)), 'belum');
  assert.equal(pushStatus(facts('granted', true, installed)), 'aktif');
  assert.equal(pushStatus(facts('denied', false, installed)), 'diblokir');
});

test('iOS before 16.4 has no web push at all', () => {
  assert.equal(
    pushStatus(facts(null, false, p(UA.iphone16_3), false)),
    'tidak-didukung',
  );
  assert.equal(
    pushStatus(
      facts(null, false, p(UA.iphone16_3, { standalone: true }), false),
    ),
    'tidak-didukung',
  );
});

test('LINE on Android has no push: unsupported', () => {
  assert.equal(
    pushStatus(facts(null, false, p(UA.androidLine), false)),
    'tidak-didukung',
  );
});

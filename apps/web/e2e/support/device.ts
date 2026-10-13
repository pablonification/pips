/**
 * Devices for Pasang PIPS! and the push states (P1-C): user agents for Android Chrome, iPhone Safari and LINE's
 * in-app browser, and a stub of Chrome's `beforeinstallprompt`. Use the agents with
 * `test.use({ userAgent: UA.iphone, installed: false })`.
 */
import type { BrowserContext, Page } from '@playwright/test';

export const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  line: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0',
} as const;

/**
 * Chrome's install prompt: fires `beforeinstallprompt` once the page has loaded, with a `prompt()` that records the
 * call and a `userChoice` answering `outcome`.
 */
export async function stubInstallPrompt(
  context: BrowserContext,
  outcome: 'accepted' | 'dismissed' = 'accepted',
) {
  await context.addInitScript((o) => {
    const w = window as unknown as { __e2ePrompt: { prompts: number } };
    w.__e2ePrompt = { prompts: 0 };
    window.addEventListener('load', () => {
      const e = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(e, {
        prompt: () => {
          w.__e2ePrompt.prompts += 1;
          return Promise.resolve();
        },
        userChoice: Promise.resolve({ outcome: o, platform: 'web' }),
      });
      window.dispatchEvent(e);
    });
  }, outcome);
}

export const installPrompts = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __e2ePrompt?: { prompts: number } }).__e2ePrompt
        ?.prompts ?? 0,
  );

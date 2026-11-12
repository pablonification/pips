/**
 * What every journey against the real API shares: signing in as a seeded member, and a watch on the browser that
 * fails the test on a console error, a request that failed, or an API answer of 400 or more.
 */
import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { REAL_API_URL } from './ports.mjs';
import { REAL_BYPASS_KEY } from './secrets.mjs';

/** The seeded members' student numbers (apps/api/src/db/seed/sample-hmif.ts). */
export const MEMBER = {
  anggota: '13525901',
  pengurus: '13524901',
  welfare: '18224902',
  otherAngkatan: '13524903',
} as const;

export type Member = keyof typeof MEMBER;

/**
 * Signs `context` in as `member` through the API's login bypass, which keeps the session cookie in the context. The
 * route exists only on a development or staging API with a strong key (apps/api/src/lib/login-bypass.ts).
 */
export async function signIn(context: BrowserContext, member: Member) {
  const response = await context.request.get(
    `${REAL_API_URL}/api/auth/login/bypass`,
    { params: { token: REAL_BYPASS_KEY, nim: MEMBER[member] } },
  );
  expect(response.status(), `sign in as ${member}`).toBe(200);
}

/** Problems seen on `page`: console errors, failed requests and API answers of 400 or more, unless `allow` says so. */
export function watch(
  page: Page,
  allow: (url: string, status: number) => boolean = () => false,
) {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) =>
    problems.push(`page error: ${error.message}`),
  );
  page.on('requestfailed', (request) => {
    // A navigation away cancels requests still in flight; that is not a failure.
    if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
    problems.push(
      `failed: ${request.method()} ${request.url()} ${request.failure()?.errorText}`,
    );
  });
  page.on('response', (response) => {
    const url = response.url();
    if (
      url.startsWith(REAL_API_URL) &&
      response.status() >= 400 &&
      !allow(url, response.status())
    )
      problems.push(
        `${response.status()}: ${response.request().method()} ${url}`,
      );
  });
  return problems;
}

type Fixtures = { problems: string[] };

/** `page` is signed in as the plain anggota and watched; the test fails on any problem `watch` saw. */
export const test = base.extend<Fixtures & { member: Member }>({
  member: ['anggota', { option: true }],
  problems: async ({ page, context, member }, use) => {
    await signIn(context, member);
    const problems = watch(page);
    await use(problems);
    expect(problems, 'console errors, failed requests or API errors').toEqual(
      [],
    );
  },
});

export { expect };

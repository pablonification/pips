/**
 * Tautan pendek against the real API: Nadia makes a short link, and opening it on the short-link host (s.hmif.dev in
 * production, `s.localhost` here) lands on its destination, by its exact name and in other capitals; the click is
 * counted. Each run makes a new name, since a name is never given out twice.
 */
import { REAL_API_URL, REAL_SHORT_URL, REAL_WEB_URL } from './ports.mjs';
import type { Page } from '@playwright/test';
import { expect, test } from './support';

/** A request from the web app's own page, with its session, as the app makes them. */
const fromApp = async (
  page: Page,
  method: string,
  path: string,
  body?: unknown,
) =>
  await page.evaluate(
    async ({ url, method, body }) => {
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, body: (await res.json()) as unknown };
    },
    { url: `${REAL_API_URL}/api${path}`, method, body },
  );

test('a link made in PIPS! opens through the short-link host and counts its clicks', async ({
  page,
  problems,
}) => {
  const name = `Real-${Date.now().toString(36)}`;
  const destination = `${REAL_WEB_URL}/layanan`;
  await page.goto('/layanan');
  await expect(
    page.getByRole('heading', { name: 'Layanan' }).first(),
  ).toBeVisible();
  const made = await fromApp(page, 'POST', '/short-links', {
    destination,
    name,
  });
  expect(made.status).toBe(201);
  const link = made.body as { id: string; name: string };
  expect(link.name).toBe(name);

  await page.goto(`${REAL_SHORT_URL}/${name}`);
  await expect(page).toHaveURL(destination);
  await expect(
    page.getByRole('heading', { name: 'Layanan' }).first(),
  ).toBeVisible();

  await page.goto(`${REAL_SHORT_URL}/${name.toUpperCase()}`);
  await expect(page).toHaveURL(destination);

  // Clicks are written together a few seconds later, on the real clock.
  await expect
    .poll(
      async () =>
        (
          (await fromApp(page, 'GET', `/short-links/${link.id}`)).body as {
            clicks: number;
          }
        ).clicks,
      { timeout: 15_000, intervals: [1000] },
    )
    .toBe(2);
  expect(problems).toEqual([]);
});

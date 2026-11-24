/**
 * Tautan pendek against the real API: Nadia makes a short link, and opening it on the short-link host (s.hmif.dev in
 * production, `s.localhost` here) lands on its destination, by its exact name and in other capitals; the click is
 * counted. Each run makes a new name, since a name is never given out twice.
 */
import { REAL_API_URL, REAL_SHORT_URL, REAL_WEB_URL } from './ports.mjs';
import { expect, test } from './support';

test('a link made in PIPS! opens through the short-link host and counts its clicks', async ({
  page,
  context,
  problems,
}) => {
  const name = `Real-${Date.now().toString(36)}`;
  const destination = `${REAL_WEB_URL}/layanan`;
  const made = await context.request.post(`${REAL_API_URL}/api/short-links`, {
    data: { destination, name },
    headers: { Origin: REAL_WEB_URL },
  });
  expect(made.status()).toBe(201);
  const link = (await made.json()) as { id: string; name: string };
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
      async () => {
        const res = await context.request.get(
          `${REAL_API_URL}/api/short-links/${link.id}`,
        );
        return ((await res.json()) as { clicks: number }).clicks;
      },
      { timeout: 15_000, intervals: [1000] },
    )
    .toBe(2);
  expect(problems).toEqual([]);
});

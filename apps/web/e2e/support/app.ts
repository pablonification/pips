/** Small helpers for driving today's app; the redesign replaces them along with the screens. */
import type { Page, TestInfo } from '@playwright/test';

export const isPhone = (testInfo: TestInfo) =>
  testInfo.project.name.includes('phone');

/** The visible copy of a text: today's app renders its phone and desktop layouts side by side and hides one. */
export const visibleText = (page: Page, text: string | RegExp) =>
  page.getByText(text).locator('visible=true').first();

/** The page's visible text (hidden layouts excluded), for text split across elements. */
export const pageText = (page: Page) =>
  page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

/** The Timeline page's title: "Timeline" on phones, the HMIF banner heading on desktop. */
export const timelineTitle = (page: Page) =>
  page
    .getByRole('heading', {
      name: /^(Timeline|Himpunan Mahasiswa Informatika ITB)$/,
    })
    .locator('visible=true')
    .first();

/** Navigation item for a top-level destination, whichever layout shows it. */
export const navLink = (page: Page, name: 'Home' | 'Timeline' | 'Settings') =>
  page.getByRole('link', { name, exact: true }).locator('visible=true').first();

/** Waits until web fonts are ready, images have loaded, and nothing moves between two frames. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            }),
        ),
    );
    const frames = () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    await frames();
    // Paint every image again now that it is decoded. Chromium sometimes draws an image before its decode has
    // finished and keeps that raster; an SVG at a fractional position (Timeline's clear button) then lands half a
    // pixel apart from one run to the next.
    const images = [...document.images].map((img) => ({
      img,
      visibility: img.style.visibility,
    }));
    for (const { img } of images) img.style.visibility = 'hidden';
    await frames();
    for (const { img, visibility } of images) img.style.visibility = visibility;
    await frames();
  });
}

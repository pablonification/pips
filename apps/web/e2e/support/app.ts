/** Small helpers for driving today's app; the redesign replaces them along with the screens. */
import type { Page, TestInfo } from '@playwright/test';

/** A touch layout below 1024 px (phone or tablet), where today's screens show their phone layout. */
export const isPhone = (testInfo: TestInfo) =>
  /phone|tablet/.test(testInfo.project.name);

/** The shell's layout for a journey project (P0-C): tab bar below 640 px, rail from 640 px, sidebar from 1024 px. */
export const layoutOf = (testInfo: TestInfo): 'phone' | 'tablet' | 'desktop' =>
  testInfo.project.name.includes('tablet')
    ? 'tablet'
    : testInfo.project.name.includes('phone')
      ? 'phone'
      : 'desktop';

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

/**
 * The shell's way to a destination, whichever layout shows it (P0-C): a tab, a rail or sidebar item, and for
 * Profil your avatar (phones and tablets) or your name at the sidebar's foot (desktop).
 */
export const navLink = (
  page: Page,
  name: 'Beranda' | 'Pengumuman' | 'Kalender' | 'Layanan' | 'Profil',
) =>
  name === 'Profil'
    ? page
        .getByRole('link', { name: /^Profil, |Profil$/ })
        .locator('visible=true')
        .first()
    : page
        .getByRole('navigation', { name: 'Navigasi utama' })
        .getByRole('link', { name: new RegExp(`^${name}`) });

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

/** Beranda's greeting from the shell ("Halo, Nadia"): Beranda is open and the member is signed in. */
export const greeting = (page: Page, firstName = 'Nadia') =>
  page.getByRole('heading', { name: `Halo, ${firstName}` });

/** Text inside the page itself (the main landmark), not in the shell's bars or sidebar. */
export const inMain = (page: Page, text: string | RegExp) =>
  page.getByRole('main').getByText(text).locator('visible=true').first();

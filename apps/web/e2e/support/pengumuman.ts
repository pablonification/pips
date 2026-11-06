/**
 * Helpers for the Pengumuman journeys (P1-B): where a post opens in each layout, the unread count in its three
 * places, and the strict quality gates every state is checked against.
 */
import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { audit, gateFailures } from './audit';
import type { Info } from '../../src/api/generated';
import { layoutOf } from './app';

export const P1 = 'Jadwal UTS Ganjil 2026/2027 sudah keluar';
export const P2 = 'Cari tim Gemastik XIX? Isi form ini';
export const P4_TEXT = 'Info beasiswa bulan Oktober sudah diperbarui';
export const P5 = 'Rapat koordinasi divisi Akademik';
export const P7 = 'Ketinggalan jaket abu-abu di GKU Timur';

/**
 * A post's title in the feed, whatever the layout: a card on phones and tablets, a row on desktop, where the same
 * title is also the open post's heading beside it (so the feed's list scopes it). Not exact: an unread row adds
 * "belum dibaca" for screen readers.
 */
export const inFeed = (page: Page, title: string) =>
  page.getByRole('listitem').getByText(title);

export const isDesk = (t: TestInfo) => layoutOf(t) === 'desktop';

/** SPEC's gates, strict: zero serious or critical axe findings, no sideways scroll, no text under 12 px, lang id. */
export async function strictGates(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  const a = await audit(page);
  const failures = gateFailures(a);
  await testInfo.attach(`gates-${name}.json`, {
    body: JSON.stringify({ mode: 'strict', failures, ...a }, null, 2),
    contentType: 'application/json',
  });
  expect(failures, `quality gates on ${name}`).toEqual([]);
}

/** A post in the list: its card's title link (phones, tablets) or its row (desktop). */
export const postInList = (page: Page, testInfo: TestInfo, id: string) =>
  isDesk(testInfo)
    ? page.locator(`[data-post-row="${id}"]`)
    : page.locator(`[data-post-link="${id}"]`);

/** The card of a post (phones and tablets). */
export const card = (page: Page, title: string | RegExp) =>
  page.getByRole('article', {
    name: typeof title === 'string' ? new RegExp(`^${escape(title)}`) : title,
  });

/** The post pane or page. */
export const detail = (page: Page) => page.locator('article.g-detail');

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The unread count on the "Belum dibaca" chip and in the navigation (tab, rail or sidebar); none at 0. */
export async function expectUnread(page: Page, n: number) {
  const chip = page.getByRole('button', { name: /^Belum dibaca/ });
  if (await chip.count())
    await expect(chip).toHaveAccessibleName(
      n ? `Belum dibaca ${n}` : 'Belum dibaca',
    );
  const nav = page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .getByRole('link', { name: /^Pengumuman/ });
  // ", n belum dibaca" on the tab bar and rail (one aria-label); " n belum dibaca" in the desktop sidebar.
  const desk = (page.viewportSize()?.width ?? 0) >= 1024;
  await expect(nav).toHaveAccessibleName(
    n
      ? desk
        ? `Pengumuman ${n} belum dibaca`
        : `Pengumuman, ${n} belum dibaca`
      : 'Pengumuman',
  );
}

/** The menu button of a post on this screen ("Opsi untuk …"). */
export const menuButton = (page: Page, title: string) =>
  page.getByRole('button', { name: `Opsi untuk ${title}` });

export const toastText = (page: Page, text: string | RegExp) =>
  page.locator('.g-toast-region').getByText(text);

/** Wait until the element has focus. */
export async function expectFocused(locator: Locator) {
  await expect(locator).toBeFocused();
}

/**
 * A feed long enough to show what the short sample data hides (owner, 2026-11-06: desktop Pengumuman "broken as
 * hell" on real data): `n` posts, every one unread, with long titles, unbroken words and URLs (as real posts have),
 * long text and a long author name. Newest first, a minute apart.
 */
export function longPosts(base: Info, n = 30): Info[] {
  const url =
    'https://docs.google.com/forms/d/e/1FAIpQLSdPendaftaranPanitiaWisudaJuliHMIFITB2026TahapKedua/viewform?usp=sf_link';
  return Array.from({ length: n }, (_, i) => ({
    ...base,
    id: `long${i}`,
    title:
      i % 3 === 0
        ? `[OPEN RECRUITMENT] Pendaftaran panitia ${i + 1}: ${url}`
        : i % 3 === 1
          ? `PENGUMUMANPENTINGUNTUKSELURUHANGGOTAHIMPUNANMAHASISWAINFORMATIKA${i + 1}`
          : `Pengumuman panjang ${i + 1} tentang kegiatan himpunan yang judulnya memang sangat panjang sekali`,
    content: `Halo, Pips! Daftar di ${url} sebelum tanggal 20.\n\n${'Isi pengumuman yang panjang. '.repeat(40)}\n\n${'Sangatpanjangtanpaspasi'.repeat(8)}`,
    creator: {
      ...base.creator,
      fullName: 'Muhammad Fadhil Ramadhan Kusumawardhana Prawiranegara',
    },
    createdAt: new Date(Date.parse(base.createdAt) - i * 60e3).toISOString(),
    isRead: false,
  }));
}

/**
 * Nothing scrolls sideways (owner, 2026-11-06): no element is scrolled to the side, and no scrolling area (the shell's,
 * Pengumuman's two columns) is wider than its box, so focusing something can't push the page sideways.
 */
export async function expectNoSidewaysScroll(page: Page) {
  const wide = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const ox = getComputedStyle(el).overflowX;
      // A clipped box (`overflow: hidden`: line clamps, screen-reader text) only counts once something scrolls it.
      const scrolls = ox === 'auto' || ox === 'scroll';
      if (el.scrollLeft !== 0 || (scrolls && el.scrollWidth > el.clientWidth))
        out.push(
          `${el.tagName.toLowerCase()}.${el.className} scrollLeft ${el.scrollLeft}, ${el.scrollWidth} wide in ${el.clientWidth}`,
        );
    }
    return out;
  });
  expect(wide, 'areas that scroll sideways').toEqual([]);
}

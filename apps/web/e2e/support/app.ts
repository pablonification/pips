/** Small helpers for driving the app in journeys, captures and fidelity runs. */
import type { Page, TestInfo } from '@playwright/test';

/** A touch layout below 1024 px (phone or tablet): the tab bar or rail, no sidebar. */
export const isPhone = (testInfo: TestInfo) =>
  /phone|tablet/.test(testInfo.project.name);

/** The shell's layout for a journey project: tab bar below 640 px, rail from 640 px, sidebar from 1024 px. */
export const layoutOf = (testInfo: TestInfo): 'phone' | 'tablet' | 'desktop' =>
  testInfo.project.name.includes('tablet')
    ? 'tablet'
    : testInfo.project.name.includes('phone')
      ? 'phone'
      : 'desktop';

/**
 * The shell's way to a destination, whichever layout shows it: a tab, a rail or sidebar item, and for
 * Profil your avatar (phones and tablets) or your name at the sidebar's foot (desktop).
 */
export const navLink = (
  page: Page,
  name: 'Beranda' | 'Pengumuman' | 'Kalender' | 'Layanan' | 'Profil',
) =>
  name === 'Profil'
    ? page.getByRole('link', { name: /^Profil, |Profil$/ })
    : page
        .getByRole('navigation', { name: 'Navigasi utama' })
        .getByRole('link', { name: new RegExp(`^${name}`) });

/** Beranda's greeting from the shell ("Halo, Nadia"): Beranda is open and the member is signed in. */
export const greeting = (page: Page, firstName = 'Nadia') =>
  page.getByRole('heading', { name: `Halo, ${firstName}` });

/** Text inside the page itself (the main landmark), not in the shell's bars or sidebar. */
export const inMain = (page: Page, text: string | RegExp) =>
  page.getByRole('main').getByText(text).locator('visible=true').first();

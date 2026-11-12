import { expect, test } from '../support/test';

// Ding Dong and Info Lomba are checked in dingdong.spec.ts and lomba.spec.ts.

// The external services (https, a new tab, named "situs luar, tab baru") are checked on Layanan in layanan.spec.ts.

// Beranda's tiles and Pintasan link to the same services.
test('external services keep their s.hmif.dev links, now over https in a new tab', async ({
  page,
}, testInfo) => {
  // Mading Beasiswa and Bayar Kas! open over https in a new tab, never in the same tab or over plain
  // http. Beranda's tiles (phones and tablets) and Pintasan (desktop) open them over https in a new tab.
  await page.goto('/');
  const desk = testInfo.project.name.startsWith('desktop');
  const links = desk
    ? [['Bayar Kas! (situs luar)', 'https://s.hmif.dev/BayarKasHMIF']]
    : [
        ['Beasiswa (situs luar)', 'https://s.hmif.dev/MadingBeasiswa'],
        ['Bayar Kas! (situs luar)', 'https://s.hmif.dev/BayarKasHMIF'],
      ];
  for (const [name, href] of links) {
    const link = page.getByRole('main').getByRole('link', { name });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  }
});

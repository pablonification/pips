import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OfflineBanner } from '../src/components/garis/State';

/*
 * The offline banner names the last update when there is one, and says only "Offline" when nothing on the page has
 * come from the server (review P1-C m5: Profil showed the current time as the last update).
 */

test('the banner names the time of the last update', () => {
  const html = renderToStaticMarkup(
    createElement(OfflineBanner, { updatedAt: '13.35' }),
  );
  assert.match(html, /Offline · diperbarui 13\.35/);
  assert.match(html, /role="status"/);
});

test('with no update to name, the banner says only Offline', () => {
  const html = renderToStaticMarkup(createElement(OfflineBanner, {}));
  assert.match(html, /<span>Offline<\/span>/);
  assert.doesNotMatch(html, /diperbarui/);
});

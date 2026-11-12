import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useDelayed } from '../src/hooks/useDelayed';
import { useNow } from '../src/hooks/useNow';
import { useOnline } from '../src/hooks/useOnline';

const Probe = () => createElement('i', null, String(useOnline()));

test('useOnline answers "online" for the first paint, whatever the device says', () => {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: false },
    configurable: true,
  });
  assert.equal(renderToStaticMarkup(createElement(Probe)), '<i>true</i>');
});

test('useDelayed shows nothing on the first paint, even for a load already under way', () => {
  const Late = () => createElement('i', null, String(useDelayed(true)));
  assert.equal(renderToStaticMarkup(createElement(Late)), '<i>false</i>');
});

test('useNow starts at the current time, whatever its period', () => {
  const Clock = ({ every }: { every: number }) =>
    createElement('i', null, String(useNow(every)));
  for (const every of [30_000, 60_000]) {
    const before = Date.now();
    const shown = Number(
      renderToStaticMarkup(createElement(Clock, { every })).replace(
        /<\/?i>/g,
        '',
      ),
    );
    assert.ok(shown >= before && shown <= Date.now());
  }
});

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useOnline } from '../src/hooks/useOnline';

const Probe = () => createElement('i', null, String(useOnline()));

test('useOnline answers "online" for the first paint, whatever the device says', () => {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: false },
    configurable: true,
  });
  assert.equal(renderToStaticMarkup(createElement(Probe)), '<i>true</i>');
});

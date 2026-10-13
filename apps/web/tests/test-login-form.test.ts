import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  devLoginMessage,
  TestLoginForm,
} from '../src/features/masuk/TestLoginForm';

/*
 * The staging test login, with the flag on (P1-C brief, "component tests"): the production build can't show it, so
 * the journeys never see it. Rendered here on its own; the sign-in screen renders it only when
 * __TEST_LOGIN_ENABLED__ is true (scripts/verify-production-bundle.mjs and tests/test-login-mode.test.mjs keep it
 * out of production).
 */

const render = (props: Partial<Parameters<typeof TestLoginForm>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(TestLoginForm, {
      onSubmit: () => {},
      pending: false,
      error: null,
      ...props,
    }),
  );

test('Indonesian labels on Garis fields, bound to their inputs, and one submit button', () => {
  const html = render();
  assert.match(html, /Akun uji/);
  for (const [label, name, type, auto] of [
    ['Email', 'email', 'email', 'username'],
    ['Kata sandi', 'password', 'password', 'current-password'],
  ]) {
    const input = html.match(
      new RegExp(`<input[^>]*name="${name}"[^>]*>`),
    )?.[0];
    assert.ok(input, `${name} input`);
    assert.match(input, new RegExp(`type="${type}"`));
    assert.match(
      input,
      new RegExp(`autoComplete="${auto}"|autocomplete="${auto}"`),
    );
    const id = input.match(/id="([^"]+)"/)?.[1];
    assert.ok(id, `${name} has an id`);
    assert.match(html, new RegExp(`<label[^>]*for="${id}"[^>]*>${label}<`));
  }
  assert.match(
    html,
    /<button[^>]*type="submit"[^>]*>Masuk dengan akun uji<\/button>/,
  );
  assert.doesNotMatch(html, /role="alert"/);
});

test('wrong credentials and an unavailable test account each say so, on the field and as an alert', () => {
  const wrong = render({ error: { status: 401 } });
  assert.match(wrong, /role="alert"[^>]*>Email atau kata sandi salah\./);
  assert.match(wrong, /aria-invalid="true"/);
  const off = render({ error: { status: 404 } });
  assert.match(off, /Akun uji tidak tersedia di server ini\./);
  assert.equal(devLoginMessage(null), null);
  assert.equal(
    devLoginMessage({ status: 0 }),
    'Akun uji tidak tersedia di server ini.',
  );
});

test('while signing in, the button says Masuk… and is unavailable rather than disabled', () => {
  const html = render({ pending: true });
  assert.match(html, /<button[^>]*aria-disabled="true"[^>]*>Masuk…<\/button>/);
  assert.doesNotMatch(html, /<button[^>]*\sdisabled=""/);
});

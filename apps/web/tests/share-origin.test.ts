import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sharedFromAnotherSite } from '../src/lib/share-origin';

const OWN = 'https://app.hmif.dev';
const from = (headers: Record<string, string>) =>
  sharedFromAnotherSite(new Headers(headers), OWN);

test('a share from the device, or from the app itself, is handled', () => {
  assert.equal(from({}), false);
  assert.equal(from({ Origin: 'null' }), false);
  assert.equal(from({ Origin: OWN }), false);
  assert.equal(from({ 'Sec-Fetch-Site': 'same-origin', Origin: OWN }), false);
  assert.equal(from({ 'Sec-Fetch-Site': 'none' }), false);
});

test('a share posted by another website is refused', () => {
  assert.equal(from({ Origin: 'https://evil.example' }), true);
  assert.equal(from({ Origin: 'https://app.hmif.dev.evil.example' }), true);
  assert.equal(from({ 'Sec-Fetch-Site': 'cross-site' }), true);
  assert.equal(from({ 'Sec-Fetch-Site': 'cross-site', Origin: 'null' }), true);
});

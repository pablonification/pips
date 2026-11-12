import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  createUpdateGate,
  holdsText,
  holdUpdateWhile,
} from '../src/lib/update-gate';

/*
 * A new version takes over the tab only when nothing would be lost: no text box holds text and nothing is being
 * sent. Otherwise it waits for the next move to another page (or the next start).
 */

function harness() {
  const busy = { typing: false, sending: false };
  let reloads = 0;
  const gate = createUpdateGate({
    typing: () => busy.typing,
    sending: () => busy.sending,
    reload: () => void reloads++,
  });
  return { busy, gate, reloads: () => reloads };
}

test('nothing typed, nothing sending: the new version applies at once', () => {
  const h = harness();
  h.gate.newVersion();
  assert.equal(h.reloads(), 1);
});

test('text in a box: the update waits, then applies on the next page', () => {
  const h = harness();
  h.busy.typing = true;
  h.gate.newVersion();
  assert.equal(h.reloads(), 0);
  h.gate.navigated();
  assert.equal(h.reloads(), 1);
  h.gate.navigated();
  assert.equal(h.reloads(), 1, 'once');
});

test('a send in flight: the update waits, also past a page change, until nothing is sending', () => {
  const h = harness();
  h.busy.sending = true;
  h.gate.newVersion();
  h.gate.navigated();
  assert.equal(h.reloads(), 0);
  h.busy.sending = false;
  h.gate.navigated();
  assert.equal(h.reloads(), 1);
});

test('no new version: moving between pages never reloads', () => {
  const h = harness();
  h.gate.navigated();
  h.gate.navigated();
  assert.equal(h.reloads(), 0);
});

test('which fields count as holding text', () => {
  const f = (
    o: Partial<{
      type: string;
      value: string;
      readOnly: boolean;
      disabled: boolean;
    }>,
  ) => ({
    type: 'text',
    value: '',
    readOnly: false,
    disabled: false,
    ...o,
  });
  assert.equal(holdsText([]), false);
  assert.equal(holdsText([f({}), f({ value: '   ' })]), false);
  assert.equal(holdsText([f({ value: 'Halo' })]), true);
  assert.equal(holdsText([f({ type: 'textarea', value: 'Isi' })]), true);
  assert.equal(holdsText([f({ type: 'search', value: 'kuis' })]), true);
  for (const type of [
    'checkbox',
    'radio',
    'hidden',
    'file',
    'submit',
    'button',
    'range',
    'color',
  ])
    assert.equal(holdsText([f({ type, value: 'on' })]), false, type);
  assert.equal(holdsText([f({ value: 'x', readOnly: true })]), false);
  assert.equal(holdsText([f({ value: 'x', disabled: true })]), false);
});

test('a Curhat message unsent or failed holds the update, past page changes, until the area lets go of it', () => {
  const h = harness();
  let unsent = true;
  const release = holdUpdateWhile(() => unsent);
  h.gate.newVersion();
  assert.equal(h.reloads(), 0);
  h.gate.navigated();
  assert.equal(h.reloads(), 0, 'still unsent');
  // Leaving the Curhat area drops its outbox and lets go; that page change may run before the area's cleanup.
  unsent = false;
  release();
  assert.equal(h.reloads(), 1);
  release();
  assert.equal(h.reloads(), 1, 'once');
});

test('a hold that never had anything unsent changes nothing; letting go with no update waiting never reloads', () => {
  const h = harness();
  const release = holdUpdateWhile(() => false);
  release();
  assert.equal(h.reloads(), 0);
  h.gate.newVersion();
  assert.equal(h.reloads(), 1);
});

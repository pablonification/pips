import { strict as assert } from 'node:assert';
import { test } from 'node:test';

/*
 * What a member typed and hasn't sent survives a reload of the tab (a new version, a page's code gone after a
 * deploy): the composer's draft, a comment, a Curhat message. Sent, or the member gone, it goes.
 */

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}
const tab = memoryStorage();
(globalThis as { sessionStorage?: unknown }).sessionStorage = tab;

const { readUnsent, keepUnsent, forgetUnsent } =
  await import('../src/lib/unsent-text');
const compose = await import('../src/features/pengumuman/compose-store');
const { forgetMember } = await import('../src/lib/forget-member');
const { QueryClient } = await import('@tanstack/react-query');

const composeState = () => {
  let seen: ReturnType<typeof compose.useCompose> | undefined;
  compose.setCompose((s) => (seen = s));
  return seen!;
};

test('kept text is per key, comes back, and blank text is not kept', () => {
  tab.clear();
  keepUnsent('komentar:p7', 'Di pos satpam?');
  keepUnsent('curhat:r1', 'Halo');
  assert.equal(readUnsent('komentar:p7'), 'Di pos satpam?');
  assert.equal(readUnsent('curhat:r1'), 'Halo');
  assert.equal(readUnsent('komentar:p8'), null);
  keepUnsent('komentar:p7', '   ');
  assert.equal(readUnsent('komentar:p7'), null);
  assert.equal(tab.length, 1);
});

test('forgetting a member drops every kept text, and nothing else in the tab', () => {
  tab.clear();
  tab.setItem('pips-shell', '{}');
  keepUnsent('komentar:p7', 'Di pos satpam?');
  keepUnsent('curhat:r1', 'Halo');
  forgetUnsent();
  assert.equal(readUnsent('komentar:p7'), null);
  assert.equal(readUnsent('curhat:r1'), null);
  assert.equal(tab.getItem('pips-shell'), '{}');
});

test('sign-out and a session that ended drop the kept text too', async () => {
  tab.clear();
  keepUnsent('komentar:p7', 'Di pos satpam?');
  const local = memoryStorage();
  await forgetMember({
    queryClient: new QueryClient(),
    removePersisted: () => undefined,
    storage: local,
    forgetShell: () => undefined,
    removeFormDrafts: () => undefined,
    removeUnsentText: forgetUnsent,
  });
  assert.equal(readUnsent('komentar:p7'), null);
});

test('no storage (a private window that refuses it): nothing throws, nothing is kept', () => {
  const broken = {
    get length(): number {
      throw new Error('denied');
    },
    key: () => {
      throw new Error('denied');
    },
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
    removeItem: () => {
      throw new Error('denied');
    },
  };
  assert.doesNotThrow(() => keepUnsent('komentar:p7', 'x', broken));
  assert.equal(readUnsent('komentar:p7', broken), null);
  assert.doesNotThrow(() => forgetUnsent(broken));
});

test('the composer keeps its title, text and audience in the tab, and opens with them after a reload', () => {
  tab.clear();
  compose.composerOpened();
  compose.patchDraft({ title: 'Kuis 2', body: 'Kuis 2 dimajukan.' });
  compose.patchDraft({ audType: 'angkatan', aud: ['2025'], cats: ['c1'] });
  assert.equal(tab.length, 1, 'the draft is kept');
  const key = [...tab.map.keys()][0];
  const kept = tab.getItem(key)!;
  // A reload: the module's memory is gone, the tab's storage isn't. The route's enter hook opens the composer.
  compose.setCompose((s) => ({
    ...s,
    draft: { title: '', body: '', cats: [], audType: 'all', aud: [] },
  }));
  tab.setItem(key, kept);
  compose.composerOpened();
  const { draft } = composeState();
  assert.equal(draft.title, 'Kuis 2');
  assert.equal(draft.body, 'Kuis 2 dimajukan.');
  assert.equal(draft.audType, 'angkatan');
  assert.deepEqual(draft.aud, ['2025']);
});

test('opening the composer twice (enter hook, then the screen) keeps the restored draft', () => {
  tab.clear();
  compose.composerOpened();
  compose.patchDraft({ title: 'Rapat', body: 'Rapat jam 4.' });
  compose.composerOpened();
  compose.takeShared();
  assert.equal(composeState().draft.title, 'Rapat');
});

test('posted or closed, the composer starts fresh and keeps nothing', () => {
  tab.clear();
  compose.composerOpened();
  compose.patchDraft({ title: 'Rapat', body: 'Rapat jam 4.' });
  compose.resetComposer();
  assert.equal(tab.length, 0);
  compose.composerOpened();
  assert.equal(composeState().draft.title, '');
});

test('a kept draft that is not the composer’s shape is ignored', () => {
  tab.clear();
  compose.composerOpened();
  compose.patchDraft({ title: 'x' });
  const key = [...tab.map.keys()][0];
  for (const bad of ['{', '[]', '{"title":3}', '{"audType":"semua"}']) {
    tab.setItem(key, bad);
    compose.composerOpened();
    const { draft } = composeState();
    assert.equal(draft.audType, 'all');
    assert.equal(typeof draft.title, 'string');
  }
});

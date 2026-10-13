import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { buildDb, NOW } from '../e2e/fixtures/api';
import { dayDiff, dFull, dLong, dShort, hm, rel } from '../src/lib/dates';
import {
  angLabel,
  applyReaction,
  audText,
  audienceKinds,
  audienceWords,
  canonicalView,
  canRenotify,
  displayText,
  chipLabel,
  composeBody,
  emptyReason,
  feedKey,
  feedRequest,
  firstError,
  freshDraft,
  hiddenByFilter,
  hostOf,
  isDefaultView,
  linkKind,
  menuLabel,
  menuModel,
  myReaction,
  nextOffset,
  nextReaction,
  notifyLine,
  pageUnreadIds,
  reactionCounts,
  renotifyAvailableAt,
  renotifyFailure,
  renotifyHint,
  summaryLabel,
  toggleHidden,
  topReactions,
  unreadLabel,
  uploadedUrls,
  uploadsBlock,
  validateDraft,
  withReadState,
  type Draft,
} from '../src/features/pengumuman/rules';

const nadia = buildDb('anggota');
const raka = buildDb('pengurus');
const info = (db: typeof nadia, id: string) =>
  db.infos.find((i) => i.id === id)!;
const at = (s: string) => new Date(s).getTime();
const now = at(NOW);

/* ================= Dates against the fixed clock (Kamis, 8 Oktober 2026, 13.35 WIB) ================= */

test('dates: rel, dLong, dShort and hm read WIB, whatever the device zone', () => {
  assert.equal(hm(NOW), '13.35');
  assert.equal(dLong(NOW), 'Kamis, 8 Oktober');
  assert.equal(dShort('2026-10-05T03:00:00Z'), 'Sen 5 Okt');
  assert.equal(
    dFull(info(nadia, 'p1').createdAt),
    'Kamis, 8 Oktober 2026 · 12.30',
  );
  assert.equal(rel(info(nadia, 'p1').createdAt, now), '1 jam lalu');
  assert.equal(rel(info(nadia, 'p2').createdAt, now), '2 jam lalu');
  assert.equal(rel(info(nadia, 'p3').createdAt, now), 'kemarin');
  assert.equal(rel(info(nadia, 'p6').createdAt, now), 'Sen 5 Okt');
  assert.equal(rel(now - 40 * 60e3, now), '40 menit lalu');
  assert.equal(rel(now - 20e3, now), 'baru saja');
  // 23.30 WIB on the 7th is yesterday even though it is the same UTC day as now.
  assert.equal(dayDiff('2026-10-07T16:30:00Z', now), -1);
  assert.equal(dayDiff('2026-10-07T17:00:00Z', now), 0);
});

/* ================= The view and the feed request ================= */

test('the feed request comes from the URL params; the default view is the key the device keeps', () => {
  assert.deepEqual(feedRequest({}, 0), {
    search: undefined,
    unread: 'false',
    excludeCategory: undefined,
    offset: 0,
    sort: 'newest',
  });
  assert.deepEqual(
    feedRequest(
      {
        search: ' beasiswa ',
        unread: true,
        excludeCategories: ['Lomba', 'Akademik'],
        sort: 'oldest',
      },
      20,
    ),
    {
      search: 'beasiswa',
      unread: 'true',
      excludeCategory: ['Akademik', 'Lomba'],
      offset: 20,
      sort: 'oldest',
    },
  );
  // A default view has no filters in its key, so persistence-policy keeps it for offline use.
  assert.deepEqual(
    feedKey('infos', { unread: false, sort: 'newest', excludeCategories: [] }),
    ['infos', undefined, undefined, undefined, undefined],
  );
  assert.ok(isDefaultView({ unread: false, search: '  ' }));
  assert.ok(!isDefaultView({ sort: 'oldest' }));
  assert.equal(canonicalView({ sort: 'weird' }).sort, undefined);
});

test('paging: 10 a page, stopping at a short page', () => {
  assert.equal(nextOffset(new Array(10).fill(0), 1), 10);
  assert.equal(nextOffset(new Array(10).fill(0), 3), 30);
  assert.equal(nextOffset(new Array(4).fill(0), 2), undefined);
});

test('the filter hides a post when any of its categories is hidden, by name', () => {
  const p1 = info(nadia, 'p1');
  assert.equal(p1.infoCategories?.[0].category.name, 'Akademik');
  assert.ok(hiddenByFilter(p1, ['Akademik']));
  assert.ok(!hiddenByFilter(p1, ['akademik'])); // ids aren't names
  assert.ok(!hiddenByFilter(p1, ['Lomba']));
  const two = {
    ...p1,
    infoCategories: [
      ...p1.infoCategories!,
      {
        infoId: 'p1',
        categoryId: 'umum',
        category: { id: 'umum', name: 'Umum', requiredPush: false },
      },
    ],
  };
  assert.ok(hiddenByFilter(two, ['Umum']));
  assert.deepEqual(toggleHidden(['Akademik'], 'Umum'), ['Akademik', 'Umum']);
  assert.deepEqual(toggleHidden(['Akademik', 'Umum'], 'Akademik'), ['Umum']);
  assert.deepEqual(
    feedRequest({ excludeCategories: ['Akademik'] }, 0).excludeCategory,
    ['Akademik'],
  );
});

test('visibility is the server’s: no rule here looks at angkatan or groups', () => {
  const src = fs.readFileSync(
    path.resolve(import.meta.dirname, '../src/features/pengumuman/rules.ts'),
    'utf8',
  );
  const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  for (const fn of ['feedRequest', 'hiddenByFilter', 'pageUnreadIds']) {
    const body = code.slice(
      code.indexOf(`function ${fn}`),
      code.indexOf('\n}\n', code.indexOf(`function ${fn}`)),
    );
    assert.doesNotMatch(body, /angkatan|infoGroups|roles/i, fn);
  }
});

test('the empty list says why: the search, then unread only, then the categories; nothing when the view is the default', () => {
  assert.equal(
    emptyReason({ search: 'zzz', unread: true }),
    'Tidak ada pengumuman yang cocok dengan “zzz”.',
  );
  assert.equal(
    emptyReason({ unread: true }),
    'Semua pengumuman sudah kamu baca.',
  );
  assert.equal(
    emptyReason({ excludeCategories: ['Umum'] }),
    'Tidak ada pengumuman di kategori yang ditampilkan.',
  );
  // Nothing narrows the list (the order doesn't): no reason, and no Tampilkan semua (review minor 3).
  assert.equal(emptyReason({}), null);
  assert.equal(emptyReason({ sort: 'oldest' }), null);
  assert.equal(emptyReason({ search: '   ', excludeCategories: [] }), null);
});

/* ================= The unread count ================= */

test('the unread count ignores the feed’s search and filter, pages in the background and stops at its cap', async () => {
  const asked: number[] = [];
  const ids = await pageUnreadIds(async (offset) => {
    asked.push(offset);
    return Array.from({ length: offset < 30 ? 10 : 3 }, (_, i) => ({
      id: `u${offset + i}`,
    }));
  });
  assert.deepEqual(asked, [0, 10, 20, 30]);
  assert.equal(ids.length, 33);
  // A new member with hundreds of unread posts: at most 10 pages, then "99+".
  const many = await pageUnreadIds(async (offset) =>
    Array.from({ length: 10 }, (_, i) => ({ id: `m${offset + i}` })),
  );
  assert.equal(many.length, 100);
  assert.equal(unreadLabel(many.length), '99+');
  assert.equal(unreadLabel(99), '99');
  assert.equal(unreadLabel(4), '4');
  assert.equal(unreadLabel(0), null);
  // Reading and marking unread update the count at once.
  assert.deepEqual(withReadState(['p1', 'p2'], 'p1', true), ['p2']);
  assert.deepEqual(withReadState(['p2'], 'p1', false), ['p1', 'p2']);
  assert.deepEqual(withReadState(['p1'], 'p1', false), ['p1']);
  // Nadia's fixtures: p1–p4 unread (p5 isn't hers to see), whatever the view.
  const unread = nadia.infos.filter((i) => !i.isRead).map((i) => i.id);
  assert.deepEqual(unread, ['p1', 'p2', 'p3', 'p4']);
});

/* ================= Reactions ================= */

test('reactions: one per person; set, replace, remove; the top three; keys outside the six ignored', () => {
  const p1 = info(nadia, 'p1').reactions; // cry 12, screaming 7, fire 3, grin 2
  assert.deepEqual(topReactions(p1), ['cry', 'screaming', 'fire']);
  assert.equal(summaryLabel(p1), '24 reaksi. Beri reaksi');
  assert.equal(myReaction(p1), null);

  const set = applyReaction(p1, nextReaction(p1, 'fire'));
  assert.equal(set.userReaction, 'fire');
  assert.equal(reactionCounts(set).find((r) => r.key === 'fire')?.count, 4);
  assert.equal(set.totalReactions, 25);
  assert.equal(summaryLabel(set), 'Reaksimu Keren. 25 reaksi. Ganti reaksi');

  const replaced = applyReaction(set, nextReaction(set, 'party'));
  assert.equal(replaced.userReaction, 'party');
  assert.equal(
    reactionCounts(replaced).find((r) => r.key === 'fire')?.count,
    3,
  );
  assert.equal(
    reactionCounts(replaced).find((r) => r.key === 'party')?.count,
    1,
  );
  assert.equal(replaced.totalReactions, 25);

  assert.equal(nextReaction(replaced, 'party'), null); // yours again: remove
  const removed = applyReaction(replaced, null);
  assert.equal(removed.userReaction, undefined);
  assert.equal(removed.totalReactions, 24);

  const odd = {
    totalReactions: 5,
    reactionsCount: [{ reaction: 'thumbs', count: 5 }],
    userReaction: 'thumbs',
  };
  assert.deepEqual(topReactions(odd), []);
  assert.equal(myReaction(odd), null);
  assert.equal(chipLabel('fire', 3, true), 'Keren, 3 orang, termasuk kamu');
  assert.equal(chipLabel('cry', 12, false), 'Sedih, 12 orang');
});

/* ================= Umumkan ulang ================= */

test('Umumkan ulang: open once 3 hours have passed, against the current time; "Bisa lagi mulai" as hh.mm', () => {
  const p1 = info(raka, 'p1'); // notified 12.30
  assert.equal(renotifyHint(p1), 'Bisa lagi mulai 15.30');
  assert.equal(canRenotify(p1, now), false);
  const last = at(p1.lastNotifiedAt);
  assert.equal(canRenotify(p1, last + 3 * 36e5 - 60e3), false); // 2 h 59 min
  assert.equal(canRenotify(p1, last + 3 * 36e5), true); // exactly 3 h
  assert.equal(canRenotify(p1, last + 3 * 36e5 + 59 * 60e3), true); // 3 h 59 min: the server's old whole-hours bug
  assert.equal(
    renotifyAvailableAt(p1.lastNotifiedAt).getTime(),
    last + 3 * 36e5,
  );
  // p5 was notified on 6 Oktober: open.
  assert.equal(canRenotify(info(raka, 'p5'), now), true);
  // A 400 from the server is "still locked".
  assert.equal(renotifyFailure(400), 'locked');
  assert.equal(renotifyFailure(403), 'denied');
  assert.equal(renotifyFailure(500), 'failed');
  assert.equal(renotifyFailure(undefined), 'failed');
});

/* ================= The menu ================= */

test('menu: mark for everyone; Umumkan ulang for the author; Hapus for the author or admin ("Sebagai admin")', () => {
  const me = (db: typeof nadia) => ({ id: db.me!.id, roles: db.me!.roles });
  // Nadia on Raka's unread post.
  assert.deepEqual(menuModel(info(nadia, 'p1'), me(nadia)), {
    mark: 'read',
    renotify: false,
    remove: null,
  });
  // Nadia on a read post.
  assert.deepEqual(menuModel(info(nadia, 'p7'), me(nadia)).mark, 'unread');
  // Raka (admin) on his own post, and on Salsa's.
  assert.deepEqual(menuModel(info(raka, 'p1'), me(raka)), {
    mark: 'unread',
    renotify: true,
    remove: 'own',
  });
  assert.deepEqual(menuModel(info(raka, 'p2'), me(raka)), {
    mark: 'read',
    renotify: false,
    remove: 'admin',
  });
  // An author without admin may delete their own.
  assert.deepEqual(
    menuModel({ creatorId: 'u1', isRead: true }, { id: 'u1', roles: [] })
      .remove,
    'own',
  );
  assert.equal(menuModel({ creatorId: 'u2', isRead: true }, null).remove, null);
  assert.equal(
    menuLabel(info(nadia, 'p1')),
    'Opsi untuk Jadwal UTS Ganjil 2026/2027 sudah keluar',
  );
  assert.equal(
    menuLabel(info(nadia, 'p4')),
    'Opsi untuk pengumuman Dimas Aditya',
  );
});

/* ================= Audience ================= */

test('audText and angLabel', () => {
  assert.equal(audText(info(nadia, 'p3')), 'Untuk angkatan 2025 · PIXEL');
  assert.equal(audText(info(raka, 'p5')), 'Untuk grup Akademik');
  assert.equal(audText(info(nadia, 'p1')), 'Untuk semua anggota');
  assert.equal(audienceWords(info(raka, 'p5')), 'grup Akademik');
  assert.equal(audienceWords(info(nadia, 'p1')), 'semua anggota');
  assert.equal(angLabel({ year: 2023, name: '' }), '2023');
  assert.equal(angLabel({ year: 2022, name: 'Byte' }), '2022 · Byte');
});

/* ================= Composer ================= */

const ctx = {
  categories: raka.categories,
  angkatan: raka.angkatan,
  groups: raka.groups,
};
const draft = (d: Partial<Draft>): Draft => ({ ...freshDraft(), ...d });

test('composer: one audience kind, Grup-ku only with groups; the request body', () => {
  assert.deepEqual(audienceKinds(nadia.groups), ['all', 'angkatan']);
  assert.deepEqual(audienceKinds(raka.groups), ['all', 'angkatan', 'group']);
  assert.deepEqual(
    composeBody(
      draft({
        title: '  Kuis 2  ',
        body: '  Kuis 2 dimajukan.\n',
        cats: ['umum'],
        audType: 'angkatan',
        aud: ['angkatan-2025'],
        mediaUrls: ['https://cdn/a.png', 'https://cdn/b.png'],
      }),
    ),
    {
      title: 'Kuis 2',
      content: 'Kuis 2 dimajukan.',
      forCategories: ['umum'],
      forAngkatan: ['angkatan-2025'],
      mediaUrls: ['https://cdn/a.png', 'https://cdn/b.png'],
    },
  );
  const groups = composeBody(
    draft({ body: 'x', cats: ['umum'], audType: 'group', aud: ['akademik'] }),
  );
  assert.deepEqual(groups.forGroups, ['akademik']);
  assert.equal('forAngkatan' in groups, false);
  const all = composeBody(draft({ body: 'x', cats: ['umum'] }));
  assert.deepEqual(Object.keys(all).sort(), [
    'content',
    'forCategories',
    'title',
  ]);
});

test('composer: content 1–1,000 after trimming, at least one category, a value for Angkatan or Grup-ku; focus order', () => {
  const e = validateDraft(draft({ body: '   ' }));
  assert.deepEqual(e, {
    body: 'Isi pengumuman belum ditulis.',
    cats: 'Pilih minimal satu kategori.',
  });
  assert.equal(firstError(e), 'body');
  const a = validateDraft(
    draft({ body: 'x', cats: ['umum'], audType: 'angkatan' }),
  );
  assert.deepEqual(a, {
    aud: 'Pilih minimal satu angkatan, atau ganti ke Semua.',
  });
  assert.equal(firstError(a), 'aud');
  assert.deepEqual(
    validateDraft(draft({ body: 'x', cats: ['umum'], audType: 'group' })),
    {
      aud: 'Pilih minimal satu grup, atau ganti ke Semua.',
    },
  );
  assert.equal(firstError(validateDraft(draft({ body: 'x' }))), 'cats');
  assert.deepEqual(validateDraft(draft({ body: 'x', cats: ['umum'] })), {});
});

test('composer: the notification line for each audience and category set', () => {
  assert.equal(
    notifyLine(draft({}), ctx),
    'Notifikasi dikirim ke semua anggota, kecuali yang mematikan kategori yang kamu pilih.',
  );
  assert.equal(
    notifyLine(draft({ cats: ['akademik', 'umum'] }), ctx),
    'Notifikasi dikirim ke semua anggota, kecuali yang mematikan kategori Akademik dan Umum.',
  );
  assert.equal(
    notifyLine(draft({ audType: 'angkatan', cats: ['umum'] }), ctx),
    'Notifikasi dikirim ke angkatan yang kamu pilih, kecuali yang mematikan kategori Umum. Pengumuman ini hanya terlihat oleh mereka.',
  );
  assert.equal(
    notifyLine(
      draft({
        audType: 'angkatan',
        aud: ['angkatan-2025', 'angkatan-2024'],
        cats: ['umum'],
      }),
      ctx,
    ),
    'Notifikasi dikirim ke angkatan 2025, 2024, kecuali yang mematikan kategori Umum. Pengumuman ini hanya terlihat oleh mereka.',
  );
  assert.equal(
    notifyLine(
      draft({
        audType: 'group',
        aud: ['akademik', 'admin'],
        cats: ['himpunan'],
      }),
      ctx,
    ),
    'Notifikasi dikirim ke grup Akademik, Admin, kecuali yang mematikan kategori Himpunan. Pengumuman ini hanya terlihat oleh mereka.',
  );
  assert.equal(
    notifyLine(draft({ audType: 'group' }), ctx),
    'Notifikasi dikirim ke grup yang kamu pilih, kecuali yang mematikan kategori yang kamu pilih. Pengumuman ini hanya terlihat oleh mereka.',
  );
});

test('composer: Umumkan is blocked while a photo uploads or has failed; finished photos in order', () => {
  assert.equal(uploadsBlock([]), null);
  assert.equal(uploadsBlock([{ status: 'done', url: 'a' }]), null);
  assert.equal(
    uploadsBlock([
      { status: 'done', url: 'a' },
      { status: 'uploading', progress: 40 },
    ]),
    'Tunggu fotonya selesai diunggah.',
  );
  assert.equal(
    uploadsBlock([{ status: 'failed' }]),
    'Ada foto yang gagal diunggah. Coba lagi atau hapus fotonya.',
  );
  assert.deepEqual(
    uploadedUrls([
      { status: 'done', url: 'a' },
      { status: 'failed' },
      { status: 'done', url: 'b' },
    ]),
    ['a', 'b'],
  );
});

/* ================= Links ================= */

test('link kinds: Google Forms open in PIPS!, Sheets get the sheet tile, others the link tile', () => {
  assert.equal(
    linkKind('https://docs.google.com/forms/d/e/e2e-gemastik-tim/viewform'),
    'gform',
  );
  assert.equal(linkKind('https://forms.gle/abc'), 'gform');
  // By the address only: a page that calls itself Google Forms, or mentions the address, isn't one (review minor 5).
  assert.equal(
    linkKind('https://example.org/x', {
      ogTitle: 'Google Forms: Sign-in',
      ogDescription: 'Google Forms',
    } as never),
    'web',
  );
  assert.equal(
    linkKind('https://example.org/?next=docs.google.com/forms/d/x'),
    'web',
  );
  assert.equal(linkKind('https://docs.google.com.evil.id/forms/d/x'), 'web');
  assert.equal(linkKind('docs.google.com/forms/d/e/x/viewform'), 'gform');
  assert.equal(
    linkKind('https://s.id/x', {
      requestUrl: 'https://docs.google.com/forms/d/e/x/viewform',
    }),
    'gform',
  );
  assert.equal(
    linkKind('https://docs.google.com/spreadsheets/d/e2e-jadwal-uts'),
    'sheet',
  );
  assert.equal(linkKind('s.hmif.dev/MadingBeasiswa'), 'web');
  assert.equal(hostOf('s.hmif.dev/MadingBeasiswa'), 's.hmif.dev');
  assert.equal(
    hostOf('https://docs.google.com/spreadsheets/d/x'),
    'docs.google.com',
  );
});

test('a link alone on the last lines folds into its card; links inside the text stay', () => {
  const p1 = info(nadia, 'p1').content;
  assert.ok(
    p1.endsWith('https://docs.google.com/spreadsheets/d/e2e-jadwal-uts'),
  );
  assert.ok(displayText(p1).endsWith('untuk mata kuliah yang kamu atur.'));
  assert.equal(
    displayText('Lihat s.hmif.dev/MadingBeasiswa ya'),
    'Lihat s.hmif.dev/MadingBeasiswa ya',
  );
  assert.equal(displayText('https://forms.gle/x'), 'https://forms.gle/x'); // nothing else to show
  assert.equal(displayText('Halo\n\nhttps://a.id/x\nwww.b.id \n'), 'Halo');
  assert.equal(
    displayText('Daftar di sini\nbit.ly/DaftarGemastik'),
    'Daftar di sini',
  );
  // Only a line that is a link with a card below, and looks like a link (review minor 4).
  assert.equal(
    displayText('Berkasnya terlampir.\nfile.pdf'),
    'Berkasnya terlampir.\nfile.pdf',
  );
  assert.equal(
    displayText('Salam hangat,\nHMIF.ITB'),
    'Salam hangat,\nHMIF.ITB',
  );
  assert.equal(
    displayText('Cek tautannya:\nhttps://a.id/x lalu isi'),
    'Cek tautannya:\nhttps://a.id/x lalu isi',
  );
});

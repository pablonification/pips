// Kredit: the credits markdown read into groups, teams and people
// (src/features/profil/credits.ts), and every other shape left to the markdown renderer. Sample names, not real ones.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  dropTitle,
  isRole,
  newestFirst,
  parseCredits,
  personLine,
} from '../src/features/profil/credits';

const SAMPLE = [
  '# Credits',
  '## Panitia Khusus',
  '',
  '### Project Owner',
  "Nadia Putri - IF'21 - 13521001",
  '',
  '### Project Lead',
  "Raka Pratama - IF'21 - 13521002",
  '',
  '',
  '### Frontend',
  '#### Lead',
  "Sinta Dewi - IF'21 - 13521003",
  '#### Team',
  "Bima Arya N - STI'21 - 18221004",
  '',
  "Citra Lestari - IF'22 - 13522005",
  '',
  '### UI/UX',
  '#### Lead',
  "Dimas Saputra - STI'22 - 18222006",
  '#### Team',
  "Eka Wulandari - STI'21 - 18221007",
].join('\n');

test('the credits’ shape: a group, its roles and teams, Lead and Team, each person word for word', () => {
  const groups = parseCredits(SAMPLE);
  assert.ok(groups);
  assert.equal(groups.length, 1);
  const [g] = groups;
  assert.equal(g.title, 'Panitia Khusus');
  assert.deepEqual(
    g.sections.map((s) => s.title),
    ['Project Owner', 'Project Lead', 'Frontend', 'UI/UX'],
  );
  assert.deepEqual(g.sections[0].parts, [
    {
      label: null,
      people: [{ name: 'Nadia Putri', angkatan: "IF'21", nim: '13521001' }],
    },
  ]);
  const fe = g.sections[2];
  assert.deepEqual(
    fe.parts.map((p) => [p.label, p.people.map((x) => x.name)]),
    [
      ['Lead', ['Sinta Dewi']],
      ['Team', ['Bima Arya N', 'Citra Lestari']],
    ],
  );
  assert.equal(personLine(fe.parts[1].people[0]), "STI'21 · 18221004");
  // A role has its people straight under it; a team has Lead and Team.
  assert.deepEqual(g.sections.map(isRole), [true, true, false, false]);
  assert.ok(isRole(g.sections[1]));
  assert.ok(!isRole(fe));
});

test('teams before any group, an en dash, and trailing spaces still read', () => {
  const groups = parseCredits(
    "### Backend  \n#### Lead\nFajar Nugroho – IF'22 – 13522008  \n",
  );
  assert.deepEqual(groups, [
    {
      title: null,
      sections: [
        {
          title: 'Backend',
          parts: [
            {
              label: 'Lead',
              people: [
                { name: 'Fajar Nugroho', angkatan: "IF'22", nim: '13522008' },
              ],
            },
          ],
        },
      ],
    },
  ]);
});

test('any other shape falls back to the markdown: a paragraph, another person line, an empty team, a stray heading', () => {
  for (const md of [
    '# Credits\n\nPIPS! dibuat dan dirawat oleh HMIF ITB.',
    "## Tim\n### Frontend\nNadia Putri - IF'21",
    "## Tim\n### Frontend\nNadia Putri (IF'21, 13521001)",
    "## Tim\n### Frontend\n#### Lead\n#### Team\nNadia Putri - IF'21 - 13521001",
    '## Tim\n### Frontend',
    '## Tim',
    "Nadia Putri - IF'21 - 13521001",
    "## Tim\n#### Lead\nNadia Putri - IF'21 - 13521001",
    "## Tim\n### Frontend\nNadia Putri - IF'21 - 13521001\n# Lagi",
    "## Tim\n### Frontend\n- Nadia Putri - IF'21 - 13521001",
    "## Tim\n### Frontend\n[Nadia](https://example.com) - IF'21 - 13521001",
    '',
  ])
    assert.equal(parseCredits(md), null, JSON.stringify(md));
});

test('the text’s own "Credits" title goes (the page’s title says it); other first headings stay', () => {
  assert.equal(
    dropTitle('# Credits\n\nPIPS! dibuat dan dirawat oleh HMIF ITB.'),
    '\nPIPS! dibuat dan dirawat oleh HMIF ITB.',
  );
  assert.equal(dropTitle('#  kredit\nIsi'), 'Isi');
  assert.equal(dropTitle('# Tim PIPS!\nIsi'), '# Tim PIPS!\nIsi');
  assert.equal(dropTitle('Isi\n# Credits'), 'Isi\n# Credits');
});

test('the newest group first: the server writes its groups oldest first, and the page reverses them', () => {
  const groups = parseCredits(
    [
      '# Credits',
      '## Panitia Khusus (versi pertama)',
      '### Project Owner',
      "Nadia Putri - IF'21 - 13521901",
      '## Redesign',
      '### Lead & Implementer',
      "Raka Pratama - STI'23 - 18223902",
      '## Perawatan',
      '### Backend',
      '#### Lead',
      "Sinta Dewi - IF'24 - 13524903",
    ].join('\n'),
  );
  assert.ok(groups);
  const shown = newestFirst(groups);
  assert.deepEqual(
    shown.map((g) => g.title),
    ['Perawatan', 'Redesign', 'Panitia Khusus (versi pertama)'],
  );
  // The parsed groups stay in the server's order, and each group's own teams keep theirs.
  assert.deepEqual(
    groups.map((g) => g.title),
    ['Panitia Khusus (versi pertama)', 'Redesign', 'Perawatan'],
  );
  assert.equal(shown[0], groups[2]);
});

test('one group, or teams with no group, show as they are', () => {
  const one = parseCredits(
    "## Tim\n### Frontend\nNadia Putri - IF'21 - 13521901",
  );
  assert.ok(one);
  assert.deepEqual(newestFirst(one), one);
  const none = parseCredits("### Frontend\nNadia Putri - IF'21 - 13521901");
  assert.ok(none);
  assert.deepEqual(
    newestFirst(none).map((g) => g.title),
    [null],
  );
  assert.deepEqual(newestFirst([]), []);
});

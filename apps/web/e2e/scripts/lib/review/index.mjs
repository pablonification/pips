// The review package's index.html (F1 brief, step 12): one static page built from data/*.json, with the data written
// into the page. It opens from the file system in Safari and Chrome: no fetch, no module scripts, no request outside
// the folder, no external fonts. Everything the owner reads is rendered here, escaped; the small script in
// assets/review.js only switches videos, jumps to steps, filters, keeps notes in localStorage and shows the
// "download the media" line when media/ is missing. Unit-tested in tests/review-index.test.mjs.

/** @param {unknown} s */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * A table's opening, inside a scroll region the keyboard can reach: on a phone a wide table scrolls sideways, and
 * axe's scrollable-region-focusable asks that the scroll area take focus (F1 part 2: the checks table at 390 px).
 * Close it with `</table></div>`. `caption` is HTML, already escaped.
 * @param {string} caption
 */
export const scrollTable = (caption) =>
  `<div class="tscroll" role="region" tabindex="0" aria-label="${caption}"><table><caption>${caption}</caption>`;

/**
 * A path inside the package, for src and href. Anything absolute, with a scheme, or leaving the folder is refused:
 * the page must load nothing from outside it.
 * @param {string} p
 */
export function rel(p) {
  const s = String(p);
  if (
    !s ||
    /^[a-z][a-z0-9+.-]*:/i.test(s) ||
    s.startsWith('/') ||
    s.startsWith('\\') ||
    s.split('/').includes('..')
  )
    throw new Error(`index: not a path inside the package: ${s}`);
  return s
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

/** JSON for a <script type="application/json"> block: nothing in it can close the script. @param {unknown} v */
export const jsonBlock = (v) =>
  JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

const STATUS_WORD = /** @type {Record<string, string>} */ ({
  passed: 'Passed',
  failed: 'Failed',
  'expected-failure': 'Fails (known finding)',
  'not recorded': 'Not recorded yet',
  close: 'Close',
  different: 'Different',
  unexplained: 'Unexplained',
  'not built yet': 'Not built',
  'prototype only': 'Prototype only',
  green: 'Green',
  red: 'Red',
  'not run': 'Not run',
  slot: 'For Dev 1',
  'needs a person': 'Needs a person',
  open: 'Open',
  decided: 'Decided',
  found: 'Found in today’s code',
  shown: 'Shown',
  checked: 'Checked',
  'not built': 'Not built',
  'out of scope': 'Out of scope',
  paired: 'Paired',
  removed: 'Removed by design',
  missing: 'Missing',
});
/** Status as word plus mark plus colour (the app's own rule, kept in the package). @param {string} s */
export const tag = (s) => {
  const good = [
    'passed',
    'close',
    'green',
    'decided',
    'shown',
    'checked',
    'paired',
  ];
  const bad = ['failed', 'unexplained', 'red', 'missing', 'expected-failure'];
  const cls = good.includes(s) ? 'ok' : bad.includes(s) ? 'bad' : 'neutral';
  const mark = cls === 'ok' ? '✓' : cls === 'bad' ? '✕' : '•';
  return `<span class="tag ${cls}"><span aria-hidden="true">${mark}</span> ${esc(STATUS_WORD[s] ?? s)}</span>`;
};

const fmtTime = (/** @type {number} */ t) => {
  const s = Math.max(0, Math.round(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** A media element's placeholder text when media/ isn't in this copy. @param {string} release */
const missingLine = (release) =>
  `Not in this copy: download ${release} from the release and unzip it here as media/.`;

/** @param {string} file @param {string} alt @param {string} release @param {string} [cls] */
const img = (file, alt, release, cls = '') =>
  `<img data-media src="${rel(file)}" alt="${esc(alt)}" loading="lazy"${cls ? ` class="${cls}"` : ''} data-missing="${esc(missingLine(release))}">`;

/** @param {any} d */
function summary(d) {
  const flows = d.flows.flows;
  const recs = flows.flatMap((/** @type {any} */ f) => f.recordings);
  const failing = flows.filter((/** @type {any} */ f) =>
    f.recordings.some(
      (/** @type {any} */ r) =>
        r.status === 'failed' || r.status === 'expected-failure',
    ),
  );
  const fid = d.fidelity.summary ?? {};
  const ba = d.beforeAfter.totals ?? {};
  const checks = d.checks.checks ?? [];
  const count = (/** @type {string} */ st) =>
    checks.filter((/** @type {any} */ c) => c.status === st).length;
  const red = checks.filter((/** @type {any} */ c) => c.status === 'red');
  const unexplained = (d.fidelity.screens ?? []).filter(
    (/** @type {any} */ s) => s.status === 'unexplained',
  );
  const q = d.questions.groups ?? [];
  const blockers = [
    ...failing.map(
      (/** @type {any} */ f) =>
        `Flow “${f.title}” fails${f.knownFailure ? `: ${f.knownFailure}` : ''}`,
    ),
    ...red.map((/** @type {any} */ c) => `Check “${c.title}” is red`),
    ...unexplained.map(
      (/** @type {any} */ s) =>
        `Screen ${s.name} differs from the prototype with no reason given`,
    ),
    ...(d.findings ?? [])
      .filter((/** @type {any} */ f) => !f.fixed)
      .map((/** @type {any} */ f) => `${f.id}: ${f.title}`),
  ];
  return `<section id="summary" aria-labelledby="summary-h">
<h2 id="summary-h">Summary for the decision</h2>
<p>This page shows; it doesn’t recommend. The go or no-go is yours.</p>
<dl class="facts">
<div><dt>Flows recorded</dt><dd>${flows.length} flows, ${recs.filter((/** @type {any} */ r) => r.file).length} recordings; ${failing.length} with a failing recording</dd></div>
<div><dt>Prototype versus app</dt><dd>${fid.close ?? 0} close, ${fid.different ?? 0} different, ${unexplained.length} unexplained, ${fid.notBuiltYet ?? 0} not built, ${fid.prototypeOnly ?? 0} prototype only</dd></div>
<div><dt>Accessibility problems (axe), before → after</dt><dd>critical ${ba.before?.critical ?? '–'} → ${ba.after?.critical ?? '–'}, serious ${ba.before?.serious ?? '–'} → ${ba.after?.serious ?? '–'}</dd></div>
<div><dt>Checks</dt><dd>${count('green')} green, ${count('red')} red, ${count('not run') + count('needs a person')} not run, ${count('slot')} for Dev 1</dd></div>
<div><dt>Open questions</dt><dd>${q.map((/** @type {any} */ g) => `${esc(g.who)}: ${g.items.filter((/** @type {any} */ i) => i.status !== 'decided').length}`).join(' · ')}</dd></div>
</dl>
<h3>Blockers and findings</h3>
${blockers.length ? `<ul class="blockers">${blockers.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '<p>None.</p>'}
</section>`;
}

/** @param {any} d */
function flowsPage(d) {
  const release = d.release;
  const byArea = d.areas.map((/** @type {any} */ a) => ({
    ...a,
    flows: d.flows.flows.filter((/** @type {any} */ f) => f.area === a.id),
  }));
  const pairsByState = new Map(
    (d.beforeAfter.pairs ?? []).map((/** @type {any} */ p) => [p.id, p]),
  );
  return `<section id="flows" aria-labelledby="flows-h">
<h2 id="flows-h">Flows</h2>
<nav aria-label="Areas"><ul class="inline">${byArea.map((/** @type {any} */ a) => `<li><a href="#area-${esc(a.id)}">${esc(a.title)}</a></li>`).join('')}</ul></nav>
${byArea
  .map(
    (
      /** @type {any} */ a,
    ) => `<section id="area-${esc(a.id)}" aria-labelledby="area-${esc(a.id)}-h">
<h3 id="area-${esc(a.id)}-h">${esc(a.title)}</h3>
${a.flows.map((/** @type {any} */ f) => flowCard(f, d, release, pairsByState)).join('\n')}
</section>`,
  )
  .join('\n')}
</section>`;
}

/** @param {any} f @param {any} d @param {string} release @param {Map<string, any>} pairsByState */
function flowCard(f, d, release, pairsByState) {
  const recs = f.recordings ?? [];
  const first = recs.find((/** @type {any} */ r) => r.file) ?? recs[0];
  const status = recs.some((/** @type {any} */ r) => r.status === 'failed')
    ? 'failed'
    : recs.some((/** @type {any} */ r) => r.status === 'expected-failure')
      ? 'expected-failure'
      : recs.every((/** @type {any} */ r) => r.status === 'passed')
        ? 'passed'
        : 'not recorded';
  const id = `flow-${f.id}`;
  const video = first?.file
    ? `<video data-media controls preload="none" playsinline poster="${rel(first.poster)}" src="${rel(first.file)}" aria-label="${esc(`Recording of ${f.title}`)}" data-missing="${esc(missingLine(release))}"></video>`
    : `<p class="muted">Not recorded yet.</p>`;
  const select =
    recs.length > 1
      ? `<label>Recording <select data-recordings="${esc(id)}">${recs
          .map(
            (/** @type {any} */ r, /** @type {number} */ i) =>
              `<option value="${i}">${esc(`${r.layout} · ${r.theme}${f.variants.length > 1 ? ` · ${r.who ?? r.variant}` : ''}`)}${r.file ? '' : ' (not recorded)'}</option>`,
          )
          .join('')}</select></label>`
      : '';
  const steps = recs
    .map(
      (/** @type {any} */ r, /** @type {number} */ i) =>
        `<ol class="steps" data-steps="${i}"${i === 0 ? '' : ' hidden'}>${(
          r.steps ?? []
        )
          .map(
            (/** @type {any} */ s) =>
              `<li><button type="button" class="link" data-t="${Number(s.at) || 0}">${esc(fmtTime(s.at))}</button> ${esc(s.title)}</li>`,
          )
          .join('')}</ol>`,
    )
    .join('');
  const locked = (f.locked ?? [])
    .map((/** @type {string} */ name) => {
      const s = (d.fidelity.screens ?? []).find(
        (/** @type {any} */ x) => x.name.includes(name) && x.sideBySide,
      );
      return s
        ? `<li><a href="${rel(s.sideBySide)}">${img(s.sideBySide, `${s.name}: prototype, app, difference`, release, 'thumb')}<span>${esc(name)}</span></a></li>`
        : `<li>${esc(name)}</li>`;
    })
    .join('');
  const pairs = (f.beforeAfter ?? [])
    .map((/** @type {string} */ sid) => pairsByState.get(sid))
    .filter(Boolean)
    .map(
      (/** @type {any} */ p) =>
        `<li>${p.image ? `<a href="${rel(p.image)}">${esc(p.title)}</a>` : esc(p.title)}</li>`,
    )
    .join('');
  const qs = (f.questions ?? [])
    .map((/** @type {string} */ q) => `<li>${esc(q)}</li>`)
    .join('');
  return `<article class="flow" id="${esc(id)}" data-flow="${esc(f.id)}" aria-labelledby="${esc(id)}-h">
<h4 id="${esc(id)}-h">${esc(f.title)} ${tag(status)}</h4>
<p class="meta">${esc(f.variants.map((/** @type {any} */ v) => v.who).join('; '))} · stories ${esc(f.stories.join(', '))} · built by ${esc(f.owners.join(', '))} · starts at <code>${esc(f.startsAt)}</code></p>
<p class="check"><strong>What to check:</strong> ${esc(f.check)}</p>
${f.knownFailure ? `<p class="fails">${esc(f.knownFailure)}</p>` : ''}
<div class="player" data-player="${esc(id)}">${video}${select}</div>
<script type="application/json" data-recordings-of="${esc(id)}">${jsonBlock(recs.map((/** @type {any} */ r) => ({ file: r.file ? rel(r.file) : null, poster: r.poster ? rel(r.poster) : null })))}</script>
<details><summary>Steps</summary>${steps || '<p class="muted">No steps recorded yet.</p>'}</details>
<details><summary>Result and checks</summary><ul>${recs
    .map(
      (/** @type {any} */ r) =>
        `<li>${esc(`${r.layout} · ${r.theme}${f.variants.length > 1 ? ` · ${r.who ?? r.variant}` : ''}`)}: ${tag(r.status)}${r.guard ? ` · ${esc(`${r.guard.answered} requests answered by the mock, ${r.guard.blocked} outside requests blocked, ${r.guard.unhandled} unanswered`)}` : ''}${
          (r.gates ?? []).length
            ? ` · ${esc(`${r.gates.length} screens audited`)}${
                r.gates.some((/** @type {any} */ g) => g.failures.length)
                  ? `: ${esc(
                      r.gates
                        .filter((/** @type {any} */ g) => g.failures.length)
                        .map(
                          (/** @type {any} */ g) =>
                            `${g.name} (${g.failures.join('; ')})`,
                        )
                        .join(', '),
                    )}`
                  : ''
              }`
            : ''
        }</li>`,
    )
    .join('')}</ul></details>
${locked ? `<details><summary>Locked screens it passes</summary><ul class="thumbs">${locked}</ul></details>` : ''}
${pairs ? `<details><summary>Before and after</summary><ul>${pairs}</ul></details>` : ''}
${qs ? `<details><summary>Deviations and open questions</summary><ul>${qs}</ul></details>` : ''}
<fieldset class="note" data-note="${esc(f.id)}"><legend>Your note on “${esc(f.title)}”</legend>
<label><input type="radio" name="ok-${esc(f.id)}" value="ok"> OK</label>
<label><input type="radio" name="ok-${esc(f.id)}" value="not ok"> Not OK</label>
<label class="block">Note <textarea rows="2" name="note-${esc(f.id)}"></textarea></label>
</fieldset>
</article>`;
}

/** @param {any} d */
function fidelityPage(d) {
  const screens = d.fidelity.screens ?? [];
  const values = (/** @type {string} */ k) =>
    [
      ...new Set(screens.map((/** @type {any} */ s) => s[k]).filter(Boolean)),
    ].sort();
  const filter = (/** @type {string} */ k, /** @type {string} */ label) =>
    `<label>${esc(label)} <select data-filter="${k}" data-scope="fidelity"><option value="">All</option>${values(
      k,
    )
      .map((v) => `<option>${esc(v)}</option>`)
      .join('')}</select></label>`;
  return `<section id="fidelity" aria-labelledby="fidelity-h">
<h2 id="fidelity-h">Prototype versus app</h2>
<p>Each locked screen next to the app and their difference. “Close” means a similarity score (SSIM, 1 is identical) of 0.95 or more. A difference with no reason in its task’s report is “unexplained”.</p>
<div class="filters">${filter('layout', 'Layout')}${filter('theme', 'Theme')}${filter('persona', 'Persona')}${filter('status', 'Status')}${filter('owner', 'Built by')}<span class="muted" aria-live="polite"><span data-count="fidelity"></span> shown</span></div>
<ul class="cards">${screens
    .map(
      (
        /** @type {any} */ s,
      ) => `<li class="card" data-scope="fidelity" data-layout="${esc(s.layout)}" data-theme="${esc(s.theme)}" data-persona="${esc(s.persona)}" data-status="${esc(s.status)}" data-owner="${esc(s.owner)}">
<h3>${esc(s.name)} ${tag(s.status)}</h3>
<p class="meta">${s.ssim != null ? esc(`SSIM ${Number(s.ssim).toFixed(3)} · ${(Number(s.changed) * 100).toFixed(1)} % of pixels differ · `) : ''}${esc(s.owner)}</p>
${s.sideBySide ? `<a href="${rel(s.sideBySide)}">${img(s.sideBySide, `${s.name}: prototype, app and difference`, d.release)}</a>` : `<p class="muted">${esc(s.status === 'prototype only' ? 'The prototype’s own screen: never built.' : 'No capture.')}</p>`}
${s.deviation ? `<p class="meta">Reason given: ${esc(s.deviation)}</p>` : ''}
</li>`,
    )
    .join('\n')}</ul>
</section>`;
}

/** @param {any} d */
function beforeAfterPage(d) {
  const t = d.beforeAfter.totals ?? {};
  const m = (/** @type {any} */ x) =>
    x
      ? esc(
          `axe critical ${x.axe?.critical ?? 0}, serious ${x.axe?.serious ?? 0} · overflow ${x.overflowX ?? 0} px · text under 12 px ${x.smallText ?? 0}${x.minPx ? ` (smallest ${x.minPx} px)` : ''} · lang "${x.lang ?? ''}"`,
        )
      : '–';
  return `<section id="before-after" aria-labelledby="ba-h">
<h2 id="ba-h">Before and after</h2>
<p>Today’s app (recorded 2026-10-12) next to the redesign, at the same sizes, in light and dark. Totals: today ${esc(`${t.before?.critical ?? '–'} critical and ${t.before?.serious ?? '–'} serious`)} accessibility problems over ${esc(t.before?.captures ?? 200)} captures; the redesign ${esc(`${t.after?.critical ?? '–'} critical and ${t.after?.serious ?? '–'} serious`)}.</p>
<ul class="cards">${(d.beforeAfter.pairs ?? [])
    .map(
      (
        /** @type {any} */ p,
      ) => `<li class="card"><h3>${esc(p.title)} <span class="muted">${esc(p.variant)}</span> ${tag(p.status)}</h3>
${p.image ? `<a href="${rel(p.image)}">${img(p.image, `${p.title}: before and after`, d.release)}</a>` : `<p class="muted">${esc(p.reason ?? '')}</p>`}
<p class="meta">Before: ${m(p.before)}</p><p class="meta">After: ${m(p.after)}</p></li>`,
    )
    .join('\n')}</ul>
</section>`;
}

/** @param {any} d */
function stillsPage(d) {
  const s = d.stills;
  return `<section id="stills" aria-labelledby="stills-h">
<h2 id="stills-h">Screens with no locked target</h2>
<p>States the prototype doesn’t show, built from its parts (D2, D3, D5, D7–D10), and P3-B’s and P3-C’s proposals, at phone, tablet and desktop size, light and dark.</p>
${(s.stills ?? [])
  .map(
    (
      /** @type {any} */ x,
    ) => `<article class="still" aria-labelledby="still-${esc(x.id)}"><h3 id="still-${esc(x.id)}">${esc(x.title)}</h3>
<p class="meta">${esc(x.owner)} · ${esc(x.source)}</p>
<ul class="thumbs">${(x.images ?? []).map((/** @type {any} */ i) => `<li><a href="${rel(i.file)}">${img(i.file, `${x.title}, ${i.layout}, ${i.theme}`, d.release, 'thumb')}</a><span>${esc(`${i.layout} · ${i.theme}`)}</span></li>`).join('')}</ul></article>`,
  )
  .join('\n')}
<h3>The app’s icons, as it ships them</h3>
<ul class="thumbs">${(s.appIcons ?? []).map((/** @type {any} */ i) => `<li>${img(i.file, i.title, d.release, 'icon')}<span>${esc(i.title)}</span></li>`).join('')}</ul>
${(s.oldFiles ?? []).length ? `<p>Old files nothing uses, kept by C1 until HMIF’s sign-off (not the app’s): ${esc(s.oldFiles.join(', '))}.</p>` : ''}
</section>`;
}

/** @param {any} d */
function newCopyPage(d) {
  const items = (d.questions.groups ?? [])
    .flatMap((/** @type {any} */ g) => g.items)
    .filter((/** @type {any} */ i) => i.kind === 'new-copy');
  return `<section id="new-copy" aria-labelledby="copy-h">
<h2 id="copy-h">New copy</h2>
<p>Every string with no prototype wording, by task, quoted as the app shows it. They need your eye.</p>
<ul class="list">${items.map((/** @type {any} */ i) => `<li><span class="meta">${esc(i.sources.map((/** @type {any} */ s) => s.file).join(', '))}</span> ${esc(i.question)}</li>`).join('')}</ul>
</section>`;
}

/** @param {any} d */
function checksPage(d) {
  return `<section id="checks" aria-labelledby="checks-h">
<h2 id="checks-h">Checks</h2>
${scrollTable('Every check on the final commit')}<thead><tr><th scope="col">Check</th><th scope="col">Result</th><th scope="col">Counts</th><th scope="col">Command and date</th></tr></thead><tbody>
${(d.checks.checks ?? [])
  .map(
    (/** @type {any} */ c) =>
      `<tr><th scope="row">${esc(c.title)}</th><td>${tag(c.status)}${
        (c.failures ?? []).length
          ? `<ul>${c.failures
              .slice(0, 20)
              .map((/** @type {string} */ x) => `<li>${esc(x)}</li>`)
              .join('')}</ul>`
          : ''
      }${c.note ? `<p class="meta">${esc(c.note)}</p>` : ''}</td><td>${esc(
        c.counts
          ? Object.entries(c.counts)
              .map(([k, v]) => `${k} ${v}`)
              .join(', ')
          : '',
      )}</td><td><code>${esc(c.command ?? '')}</code><br><span class="meta">${esc([c.date, c.commit].filter(Boolean).join(' · '))}</span></td></tr>`,
  )
  .join('\n')}
</tbody></table></div>
</section>`;
}

/** @param {any} d */
function questionsPage(d) {
  return `<section id="questions" aria-labelledby="questions-h">
<h2 id="questions-h">Open questions and decisions</h2>
<p>Grouped by who decides. Each has the default that was built, where to see it and where it comes from. Items tagged security are still open in production: take them out before this package is shown to anyone but you.</p>
<div class="filters"><label>Status <select data-filter="status" data-scope="question"><option value="">All</option><option>open</option><option>decided</option><option>found</option></select></label><label>Kind <select data-filter="kind" data-scope="question"><option value="">All</option>${[
    ...new Set(
      (d.questions.groups ?? []).flatMap((/** @type {any} */ g) =>
        g.items.map((/** @type {any} */ i) => i.kind),
      ),
    ),
  ]
    .sort()
    .map((k) => `<option>${esc(k)}</option>`)
    .join(
      '',
    )}</select></label><span class="muted" aria-live="polite"><span data-count="question"></span> shown</span></div>
${(d.questions.groups ?? [])
  .map(
    (/** @type {any} */ g) =>
      `<h3>${esc(g.who)} (${g.items.length})</h3><ul class="list">${g.items
        .map(
          (/** @type {any} */ i) =>
            `<li class="question" data-scope="question" data-status="${esc(i.status)}" data-kind="${esc(i.kind)}">${i.id ? `<strong>${esc(i.id)}</strong> ` : ''}${tag(i.status)}${(i.tags ?? []).includes('security') ? ' <span class="tag bad">security</span>' : ''} ${esc(i.question)}${i.built ? `<br><span class="meta">Built: ${esc(i.built)}</span>` : ''}${i.decision ? `<br><span class="meta">Decided by ${esc(i.decision.by)}${i.decision.date ? `, ${esc(i.decision.date)}` : ''}</span>` : ''}${(i.flows ?? []).length ? `<br><span class="meta">See: ${esc(i.flows.join(', '))}</span>` : ''}<br><span class="meta">From: ${esc(i.sources.map((/** @type {any} */ s) => `${s.file}${s.line ? `:${s.line}` : ''}`).join('; '))}</span></li>`,
        )
        .join('')}</ul>`,
  )
  .join('\n')}
</section>`;
}

/** @param {any} d */
function coveragePage(d) {
  return `<section id="coverage" aria-labelledby="coverage-h">
<h2 id="coverage-h">Story coverage</h2>
${scrollTable('SPEC’s 157 user stories')}<thead><tr><th scope="col">Story</th><th scope="col">Status</th><th scope="col">Where to see it, or why not</th></tr></thead><tbody>
${(d.coverage ?? [])
  .map(
    (/** @type {any} */ c) =>
      `<tr><th scope="row">${esc(c.story)}</th><td>${tag(c.status)}</td><td>${(c.flows ?? []).map((/** @type {string} */ f) => `<a href="#flow-${esc(f)}">${esc(f)}</a>`).join(', ')}${c.checks?.length ? `${c.flows?.length ? '; ' : ''}${esc(c.checks.join(', '))}` : ''}${c.reason ? `${c.flows?.length || c.checks?.length ? ' · ' : ''}${esc(c.reason)}` : ''}</td></tr>`,
  )
  .join('\n')}
</tbody></table></div>
</section>`;
}

/** @param {any} d */
function sizesPage(d) {
  const s = d.sizes ?? {};
  const mib = (/** @type {number} */ b) =>
    `${(b / 1024 / 1024).toFixed(1)} MiB`;
  return `<section id="sizes" aria-labelledby="sizes-h">
<h2 id="sizes-h">Sizes</h2>
${s.parts ? `${scrollTable(`The package against its budget (${esc(s.budget ? mib(s.budget) : '–')})`)}<thead><tr><th scope="col">Part</th><th scope="col">Size</th><th scope="col">Ceiling</th></tr></thead><tbody>${s.parts.map((/** @type {any} */ p) => `<tr><th scope="row">${esc(p.title)}</th><td>${esc(mib(p.bytes ?? 0))}</td><td>${esc(p.max ? mib(p.max) : '–')}</td></tr>`).join('')}</tbody></table></div>` : '<p>Not measured yet.</p>'}
</section>`;
}

/**
 * The whole page.
 * @param {{ title?: string, release: string, createdAt: string, commit: string, areas: any[], flows: any, fidelity: any,
 *   beforeAfter: any, stills: any, checks: any, questions: any, coverage: any[], sizes: any, findings?: any[] }} d
 */
export function buildIndex(d) {
  const nav = [
    ['summary', 'Summary'],
    ['flows', 'Flows'],
    ['fidelity', 'Prototype versus app'],
    ['before-after', 'Before and after'],
    ['stills', 'No locked target'],
    ['new-copy', 'New copy'],
    ['checks', 'Checks'],
    ['questions', 'Open questions'],
    ['coverage', 'Story coverage'],
    ['sizes', 'Sizes'],
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(d.title ?? 'PIPS! redesign: review package')}</title>
<link rel="stylesheet" href="assets/review.css">
</head>
<body data-release="${esc(d.release)}">
<a class="skip" href="#main">Skip to the content</a>
<header>
<h1>${esc(d.title ?? 'PIPS! redesign: review package')}</h1>
<p class="meta">Built ${esc(d.createdAt)} from <code>${esc(d.commit)}</code>, against the API mock with the prototype’s sample people and a fixed clock (Kamis, 8 Oktober 2026, 13.35 WIB).</p>
<nav aria-label="Sections"><ul class="inline">${nav.map(([id, t]) => `<li><a href="#${id}">${esc(t)}</a></li>`).join('')}</ul></nav>
<p><button type="button" data-copy-notes>Copy my notes</button> <span data-copy-status role="status"></span></p>
<p class="missing-media" hidden>The videos and images aren’t in this copy: download ${esc(d.release)} from the release and unzip it here as media/.</p>
</header>
<main id="main" tabindex="-1">
${summary(d)}
${flowsPage(d)}
${fidelityPage(d)}
${beforeAfterPage(d)}
${stillsPage(d)}
${newCopyPage(d)}
${checksPage(d)}
${questionsPage(d)}
${coveragePage(d)}
${sizesPage(d)}
</main>
<script src="assets/review.js"></script>
</body>
</html>
`;
}

/** The page's own CSS: system fonts only, light and dark from the system setting, readable from 390 to 1440 px. */
export const CSS = `:root{color-scheme:light dark;--bg:#fcfbf8;--fg:#1b1508;--muted:#5c5446;--line:#d8d2c4;--card:#fff;--ok:#1e6b34;--bad:#a1261b;--neutral:#5c5446;--accent:#7a5600}
@media (prefers-color-scheme:dark){:root{--bg:#0a0907;--fg:#efece5;--muted:#b3aa98;--line:#3a342a;--card:#181510;--ok:#7fd497;--bad:#ff9b8f;--neutral:#b3aa98;--accent:#f8c249}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
header,main{max-width:1200px;margin:0 auto;padding:16px}
h1{font-size:24px;margin:8px 0}h2{font-size:20px;margin:32px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}h3{font-size:17px;margin:20px 0 8px}h4{font-size:16px;margin:0 0 4px}
a{color:var(--accent)}code{font-size:14px}
.skip{position:absolute;left:-9999px}.skip:focus{left:16px;top:8px;background:var(--card);padding:8px;z-index:2}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}.tscroll{overflow-x:auto;max-width:100%}
.meta,.muted{color:var(--muted);font-size:14px}
.inline{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:4px 16px}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.facts div{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}.facts dt{font-weight:600}.facts dd{margin:4px 0 0}
.tag{display:inline-block;font-size:13px;font-weight:600;padding:0 6px;border-radius:4px;border:1px solid currentColor;white-space:nowrap}.tag.ok{color:var(--ok)}.tag.bad{color:var(--bad)}.tag.neutral{color:var(--neutral)}
.flow,.still{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px;margin:12px 0}
.flow video{width:100%;max-height:70vh;background:#000;border-radius:6px}
.player label{display:block;margin-top:8px;font-size:14px}
.fails{color:var(--bad);font-weight:600}
.steps{padding-left:20px}.steps li{margin:2px 0}
select{max-width:100%}main{overflow-wrap:break-word}button{font:inherit;min-height:32px;padding:4px 10px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer}
button.link{border:0;background:none;color:var(--accent);text-decoration:underline;padding:0 4px;min-height:24px}
.cards{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}.card img{width:100%;height:auto;border:1px solid var(--line)}
.thumbs{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px}.thumbs li{display:flex;flex-direction:column;font-size:13px}.thumb{width:160px;height:auto;border:1px solid var(--line)}.icon{width:64px;height:64px;object-fit:contain;border:1px solid var(--line)}
.filters{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:8px 0;position:sticky;top:0;background:var(--bg);z-index:1}
select,textarea{font:inherit;color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:6px;padding:4px}
.note{border:1px solid var(--line);border-radius:6px;margin-top:12px}.note .block{display:block}.note textarea{width:100%}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid var(--line);padding:6px;text-align:left;vertical-align:top}caption{text-align:left;font-weight:600;padding:4px 0}
.list{padding-left:20px}.list li{margin:6px 0}
.missing{color:var(--bad);font-size:14px;border:1px dashed var(--bad);padding:8px;border-radius:6px}
[hidden]{display:none!important}
@media (max-width:600px){header,main{padding:12px}.cards{grid-template-columns:1fr}}
`;

/** The page's small script: a classic script (no modules: they don't load from file:// in Chrome). */
export const JS = `(function () {
  'use strict';
  var KEY = 'pips-review-notes';
  var notes = {};
  try { notes = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { notes = {}; }
  var release = document.body.getAttribute('data-release') || 'the media zip';

  // media/ missing (a copy from Git without the release): every video and image says what to download.
  var probe = new Image();
  probe.onerror = function () {
    document.body.classList.add('no-media');
    var line = document.querySelector('.missing-media');
    if (line) line.hidden = false;
    var media = document.querySelectorAll('[data-media]');
    for (var i = 0; i < media.length; i++) {
      var p = document.createElement('p');
      p.className = 'missing';
      p.textContent = media[i].getAttribute('data-missing') || ('Not in this copy: download ' + release + '.');
      media[i].parentNode.replaceChild(p, media[i]);
    }
  };
  probe.src = 'media/present.webp';

  // A flow's recording: switch layout and theme; each step jumps the video to its time.
  var players = document.querySelectorAll('[data-player]');
  for (var k = 0; k < players.length; k++) (function (player) {
    var id = player.getAttribute('data-player');
    var card = document.getElementById(id);
    var data = [];
    var block = card.querySelector('[data-recordings-of]');
    try { data = JSON.parse(block.textContent || '[]'); } catch (e) { data = []; }
    var select = player.querySelector('select');
    var video = player.querySelector('video');
    if (select) select.addEventListener('change', function () {
      var i = Number(select.value);
      var r = data[i] || {};
      video = player.querySelector('video');
      if (video && r.file) { video.setAttribute('poster', r.poster || ''); video.src = r.file; }
      var lists = card.querySelectorAll('[data-steps]');
      for (var n = 0; n < lists.length; n++) lists[n].hidden = lists[n].getAttribute('data-steps') !== String(i);
    });
    card.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-t]') : null;
      if (!t) return;
      video = player.querySelector('video');
      if (!video) return;
      var go = function () { video.currentTime = Number(t.getAttribute('data-t')); video.play(); };
      if (video.readyState >= 1) go(); else { video.preload = 'metadata'; video.addEventListener('loadedmetadata', go, { once: true }); video.load(); }
    });
  })(players[k]);

  // Filters: each select hides the items of its scope whose data attribute differs.
  var selects = document.querySelectorAll('select[data-filter]');
  function apply(scope) {
    var mine = document.querySelectorAll('select[data-filter][data-scope="' + scope + '"]');
    var items = document.querySelectorAll('[data-scope="' + scope + '"]:not(select)');
    var shown = 0;
    for (var i = 0; i < items.length; i++) {
      var hide = false;
      for (var j = 0; j < mine.length; j++) {
        var v = mine[j].value;
        if (v && items[i].getAttribute('data-' + mine[j].getAttribute('data-filter')) !== v) hide = true;
      }
      items[i].hidden = hide;
      if (!hide) shown++;
    }
    var count = document.querySelector('[data-count="' + scope + '"]');
    if (count) count.textContent = String(shown);
  }
  var scopes = {};
  for (var s = 0; s < selects.length; s++) {
    var sc = selects[s].getAttribute('data-scope');
    scopes[sc] = true;
    selects[s].addEventListener('change', (function (x) { return function () { apply(x); }; })(sc));
  }
  for (var key in scopes) apply(key);

  // Notes: OK or not OK and a short note per flow, kept in this browser only.
  var fields = document.querySelectorAll('[data-note]');
  for (var f = 0; f < fields.length; f++) (function (fs) {
    var id = fs.getAttribute('data-note');
    var saved = notes[id] || {};
    var radios = fs.querySelectorAll('input[type=radio]');
    var area = fs.querySelector('textarea');
    for (var r = 0; r < radios.length; r++) if (radios[r].value === saved.verdict) radios[r].checked = true;
    if (area) area.value = saved.note || '';
    var save = function () {
      var verdict = '';
      for (var r = 0; r < radios.length; r++) if (radios[r].checked) verdict = radios[r].value;
      notes[id] = { verdict: verdict, note: area ? area.value : '' };
      try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch (e) {}
    };
    fs.addEventListener('change', save);
    if (area) area.addEventListener('input', save);
  })(fields[f]);

  function markdown() {
    var out = ['# My notes on the PIPS! review package', ''];
    for (var f = 0; f < fields.length; f++) {
      var id = fields[f].getAttribute('data-note');
      var n = notes[id];
      if (!n || (!n.verdict && !n.note)) continue;
      var title = (document.getElementById('flow-' + id + '-h') || {}).textContent || id;
      out.push('- **' + id + '** (' + (n.verdict || 'no verdict') + ')' + (n.note ? ': ' + n.note.replace(/\\n+/g, ' ') : ''));
    }
    return out.join('\\n') + '\\n';
  }
  var copy = document.querySelector('[data-copy-notes]');
  var status = document.querySelector('[data-copy-status]');
  if (copy) copy.addEventListener('click', function () {
    var text = markdown();
    var done = function () { if (status) status.textContent = 'Notes copied.'; };
    var fallback = function () {
      var t = document.createElement('textarea');
      t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (e) { if (status) status.textContent = 'Copy failed: select the notes and copy them yourself.'; }
      document.body.removeChild(t);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  });
  window.__reviewNotes = markdown;
})();
`;

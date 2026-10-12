// A shared page shell for the harness's HTML reports: plain, readable, no external resources.
import { esc } from './run.mjs';

/** @param {string} title @param {string} body */
export function page(title, body, script = '') {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.45; }
  body { margin: 0 auto; padding: 24px; max-width: 1600px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 28px 0 8px; }
  p, li { font-size: 14px; }
  .muted { opacity: .7; }
  .filters { position: sticky; top: 0; padding: 10px 0; background: Canvas; display: flex; gap: 16px; flex-wrap: wrap; z-index: 1; border-bottom: 1px solid #8884; }
  .filters label { font-size: 14px; display: flex; gap: 6px; align-items: center; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
  .card { border: 1px solid #8886; border-radius: 8px; padding: 10px; }
  .card img { width: 100%; height: auto; display: block; border: 1px solid #8884; background: #fff; }
  .card h3 { font-size: 14px; margin: 0 0 6px; }
  .wide .grid { grid-template-columns: 1fr; }
  .row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; align-items: start; }
  .row figure { margin: 0; }
  .row figcaption { font-size: 12px; opacity: .75; }
  .tag { display: inline-block; font-size: 12px; padding: 1px 6px; border-radius: 4px; border: 1px solid #8886; margin: 0 4px 4px 0; }
  .bad { background: #d33a; } .ok { background: #3a3a; } .warn { background: #d90a; } .none { background: #8884; }
  table { border-collapse: collapse; font-size: 13px; } td, th { border: 1px solid #8886; padding: 3px 8px; text-align: left; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
${body}
<script>${script}</script>
</body>
</html>
`;
}

/** Client-side filtering: every <select data-filter="key"> hides cards whose data-key differs. */
export const FILTER_SCRIPT = `
const selects = [...document.querySelectorAll('select[data-filter]')];
const apply = () => {
  for (const card of document.querySelectorAll('[data-card]')) {
    card.hidden = selects.some((s) => s.value && card.dataset[s.dataset.filter] !== s.value);
  }
  const n = document.querySelectorAll('[data-card]:not([hidden])').length;
  const count = document.getElementById('count'); if (count) count.textContent = n;
};
selects.forEach((s) => s.addEventListener('change', apply));
apply();
`;

/** @param {string} key @param {string} label @param {string[]} values */
export const filterSelect = (key, label, values) =>
  `<label>${esc(label)} <select data-filter="${key}"><option value="">all</option>${values.map((v) => `<option>${esc(v)}</option>`).join('')}</select></label>`;

// Fails if a production build in dist/ still contains the development test login, or the Garis gallery
// (/dev/garis, development only). Run after `pnpm build` (CI does). Staging-mode builds include both on purpose, so
// don't run this on them.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist';
const forbidden = [
  '/api/auth/login/dev',
  // A sentence only the gallery has (src/dev/garis/).
  'Sistem desain Garis · PIPS!',
];
const hits = [];
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|html)$/.test(name)) {
      const text = readFileSync(p, 'utf8');
      for (const f of forbidden) if (text.includes(f)) hits.push(`${p}: ${f}`);
    }
  }
};
walk(dir);
if (hits.length) {
  console.error(`Production bundle contains development-only code:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`ok: no test login and no Garis gallery in ${dir}`);

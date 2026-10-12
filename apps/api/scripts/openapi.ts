/**
 * Writes the API's OpenAPI document without a running server or database: builds the app with placeholder
 * settings and asks it for `/doc`, exactly what a running server answers there.
 *   tsx scripts/openapi.ts <output.json>
 * The web app's `pnpm api` runs this, then generates `apps/web/src/api/generated` from the file.
 */
import fs from 'fs';
import path from 'path';
import { usePlaceholderEnv } from './placeholder-env';

const out = process.argv[2];
if (!out) {
  console.error('usage: tsx scripts/openapi.ts <output.json>');
  process.exit(2);
}

async function main(out: string) {
  // The placeholders replace any local .env: the document must not depend on this machine's settings.
  usePlaceholderEnv();
  const { createApp } = await import('../src/app');
  const res = await createApp().request('/doc');
  if (res.status !== 200) {
    throw new Error(`/doc answered ${res.status}`);
  }
  const doc = await res.json();
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(
    `openapi: ${Object.keys(doc.paths ?? {}).length} paths written to ${out}`,
  );
}

main(out).then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

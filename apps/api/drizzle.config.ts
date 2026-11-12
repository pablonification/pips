import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- drizzle-kit needs DATABASE_URL set; let it fail if not
    url: process.env.DATABASE_URL!,
  },
});

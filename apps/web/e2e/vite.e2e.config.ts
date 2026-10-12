/**
 * The app's own Vite config, adjusted for the e2e harness:
 * - no `.env` files are read (`envDir` points at a folder without any), so a developer's `.env.local` never leaks
 *   into the build; e2e/scripts/serve.ts sets every `VITE_*` value explicitly instead;
 * - the build goes to e2e/.build, apart from `dist`;
 * - the Garis gallery (/dev/garis) is built in, so its journey and fidelity captures can run (production leaves it
 *   out; scripts/verify-production-bundle.mjs checks);
 * - `vite preview` serves it on the harness port without the dev server's proxy to the real API, so a request
 *   that slipped past the mock layer could never reach a real backend.
 */
import { defineConfig, mergeConfig, type UserConfig } from 'vite';
import appConfig from '../vite.config';

import { E2E_PORT } from './port';

export default defineConfig(async (env) => {
  const base = (
    typeof appConfig === 'function' ? await appConfig(env) : appConfig
  ) as UserConfig;
  return mergeConfig(base, {
    define: { __GARIS_GALLERY__: 'true' },
    envDir: 'e2e/.no-env',
    build: { outDir: 'e2e/.build', emptyOutDir: true },
    preview: { host: '127.0.0.1', port: E2E_PORT, strictPort: true, proxy: {} },
  } satisfies UserConfig);
});

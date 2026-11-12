/**
 * The app's own Vite config for the journeys against the real API (`e2e:real`): a production build with no `.env`
 * file read, into e2e/.build-real, served by `vite preview` on its own port with no proxy. The app calls the API on
 * its own address (`VITE_API_URL`), as production's app calls app-api.hmif.dev.
 */
import { defineConfig, mergeConfig, type UserConfig } from 'vite';
import appConfig from '../../vite.config';
import { REAL_WEB_PORT } from './ports.mjs';

export default defineConfig(async (env) => {
  const base = (
    typeof appConfig === 'function' ? await appConfig(env) : appConfig
  ) as UserConfig;
  return mergeConfig(base, {
    envDir: 'e2e/.no-env',
    build: { outDir: 'e2e/.build-real', emptyOutDir: true },
    preview: {
      host: '127.0.0.1',
      port: REAL_WEB_PORT,
      strictPort: true,
      proxy: {},
    },
  } satisfies UserConfig);
});

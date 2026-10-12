import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { VitePluginRadar } from 'vite-plugin-radar';

/**
 * Writes dist/.vite/chunk-modules.json: for each JS chunk, the modules in it (npm packages by name, app files by
 * path). The budget check (scripts/budgets.mjs) uses it to say which packages each route loads before its first
 * render, e.g. that socket.io-client loads only with Curhat and Live Counting.
 */
function chunkModules(): Plugin {
  return {
    name: 'pips-chunk-modules',
    apply: 'build',
    generateBundle(_options, bundle) {
      const root = path.resolve(import.meta.dirname);
      const chunks: Record<string, string[]> = {};
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        const modules = new Set<string>();
        for (const id of output.moduleIds) {
          const file = id.replace(/\?.*$/, '').replace(/^\0/, '');
          const pkg =
            /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/.exec(
              file,
            );
          modules.add(pkg ? `npm:${pkg[1]}` : path.relative(root, file));
        }
        chunks[output.fileName] = [...modules].sort();
      }
      this.emitFile({
        type: 'asset',
        fileName: '.vite/chunk-modules.json',
        source: `${JSON.stringify(chunks, null, 1)}\n`,
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const appName = env.VITE_APP_NAME || 'PIPS!';
  const analyticsId = env.VITE_ANALYTICS_ID || null;
  // Where the dev server sends API requests. Not VITE_-prefixed, so it never reaches the bundle.
  // Staging's API listens on 5000; on a Mac (AirPlay owns 5000) set DEV_API_ORIGIN, e.g. http://127.0.0.1:5100.
  const apiOrigin =
    loadEnv(mode, process.cwd(), 'DEV_API_ORIGIN').DEV_API_ORIGIN ||
    'http://127.0.0.1:5000';
  return {
    define: {
      __TEST_LOGIN_ENABLED__: JSON.stringify(
        (mode === 'development' || mode === 'staging') &&
          env.VITE_ENABLE_TEST_LOGIN === 'true',
      ),
      // The design-system gallery (/dev/garis) stays out of production builds; e2e/vite.e2e.config.ts turns it on.
      __GARIS_GALLERY__: JSON.stringify(mode !== 'production'),
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      allowedHosts: ['staging.hmif.dev'],
      proxy: {
        '/api': apiOrigin,
        '/socket.io': { target: apiOrigin, ws: true },
        '/swagger': apiOrigin,
        '/doc': apiOrigin,
      },
    },
    resolve: {
      alias: {
        '~': path.resolve(import.meta.dirname, './src'),
      },
    },

    plugins: [
      ...(analyticsId
        ? [
            VitePluginRadar({
              analytics: {
                id: analyticsId,
              },
            }),
          ]
        : []),
      VitePWA({
        strategies: 'injectManifest',
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true,
          type: 'module',
        },
        srcDir: 'src',
        filename: 'sw.ts',
        // Icons: scripts/icons/build-icons.py, the official logo on ink.
        manifest: {
          name: appName,
          short_name: appName,
          description: 'Aplikasi resmi Himpunan Mahasiswa Informatika ITB',
          icons: [
            {
              src: '/android-chrome-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/android-chrome-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/android-chrome-maskable-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/android-chrome-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          screenshots: [
            {
              sizes: '813x1446',
              src: '/img/ss/login.jpg',
              type: 'image/jpg',
              form_factor: 'narrow',
              label: 'Login page',
            },
          ],
          start_url: '/',
          scope: '/',
          // Long-press shortcuts on the installed app's icon: the primary destinations' URLs.
          shortcuts: [
            { name: 'Pengumuman', url: '/pengumuman' },
            { name: 'Kalender', url: '/kalender' },
            { name: 'Layanan', url: '/layanan' },
          ],
          // The app background (tokens.css --bg-app, light), so the status bar blends with the top bar; the splash is
          // the official logo on ink (SPEC "Design tokens and theming"), so its background is HMIF's ink.
          theme_color: '#FCFBF8',
          background_color: '#1B1508',
          display: 'standalone',
          share_target: {
            action: '/share-file-handler',
            method: 'POST',
            enctype: 'multipart/form-data',
            params: {
              title: 'title',
              text: 'text',
              url: 'url',
              files: [
                {
                  name: 'images',
                  accept: ['image/*'],
                },
              ],
            },
          },
        },
        // The service worker (src/sw.ts) caches only what this precaches plus same-origin images; see its header.
        // Precache: the app shell and every route chunk, never the review prototypes or other review material.
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,woff2}', 'logo/hmif.png'],
          globIgnores: ['prototypes/**', '**/*.map'],
        },
      }),
      // The router plugin must come before the React plugin. Every route's component loads on demand.
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      chunkModules(),
      sentryVitePlugin({
        authToken: env.SENTRY_AUTH_TOKEN,
        org: env.SENTRY_ORG || 'hmif',
        project: env.SENTRY_PROJECT || 'hmif-app-fe',
        disable: !env.VITE_SENTRY_DSN,
      }),
    ],

    build: {
      sourcemap: true,
      // dist/.vite/manifest.json: chunks and their imports, read by the budget check (scripts/budgets.mjs).
      manifest: true,
    },
  };
});

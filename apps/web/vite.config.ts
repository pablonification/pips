import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { VitePluginRadar } from 'vite-plugin-radar';

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
          theme_color: '#FFFFFF',
          background_color: '#2F754A',
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
        workbox: {
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^\/img\/.*\.svg$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'icons-cache',
                expiration: {
                  maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 299],
                },
              },
            },
          ],
        },
      }),
      // The router plugin must come before the React plugin. P0-B turns on automatic code splitting.
      tanstackRouter({ target: 'react', autoCodeSplitting: false }),
      react(),
      tailwindcss(),
      sentryVitePlugin({
        authToken: env.SENTRY_AUTH_TOKEN,
        org: env.SENTRY_ORG || 'hmif',
        project: env.SENTRY_PROJECT || 'hmif-app-fe',
        disable: !env.VITE_SENTRY_DSN,
      }),
    ],

    build: {
      sourcemap: true,
    },
  };
});

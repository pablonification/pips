import { IDBPDatabase, openDB } from 'idb';
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { legacyRedirectHref } from './lib/legacy-redirects';

declare let self: ServiceWorkerGlobalScope;

/*
 * What this service worker keeps (SPEC "Service worker"):
 * - the precache: the app shell and every route chunk (vite.config.ts `injectManifest`), never the review
 *   prototypes; hashed file names, so an update downloads only the chunks that changed;
 * - an app-shell fallback: any navigation in the app gets index.html, so the installed app opens offline;
 * - a bounded cache for same-origin images only. Nothing else, so no catch-all asset cache grows forever.
 */
const IMAGE_CACHE = 'images-v1';
// Caches earlier versions of this worker filled without a bound; deleted on activation.
const RETIRED_CACHES = [
  'assets-cache',
  'icons-cache',
  'google-fonts-cache',
  'gstatic-fonts-cache',
];

if (import.meta.env.PROD) {
  cleanupOutdatedCaches();
  precacheAndRoute(self.__WB_MANIFEST);

  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('/index.html'), {
      // Not the app: the API, review material, the share target and anything that is a file.
      denylist: [
        /^\/api\//,
        /^\/socket\.io\//,
        /^\/prototypes\//,
        /^\/swagger/,
        /^\/doc$/,
        /^\/share-file-handler/,
        /\/[^/?]+\.[^/?]+$/,
      ],
    }),
  );

  self.skipWaiting();
  clientsClaim();
}

registerRoute(
  ({ request, url }) =>
    request.destination === 'image' && url.origin === self.location.origin,
  new CacheFirst({
    cacheName: IMAGE_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 60 * 60 * 24 * 30,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

self.addEventListener('activate', (e) => {
  e.waitUntil(Promise.all(RETIRED_CACHES.map((name) => caches.delete(name))));
});

self.addEventListener('push', (e) => {
  if (
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted' ||
    !e.data
  ) {
    return;
  }
  try {
    const message = e.data.json();
    e.waitUntil(
      self.registration.showNotification(message.title, {
        icon: '/icon-foreground.png',
        badge: '/logo-nobg-256x256.png',
        ...message.options,
      }),
    );
  } catch (err) {
    console.error(err);
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  // The API still sends today's paths (/timeline/<id>); open the new URL directly, so an open window on it is
  // focused instead of a second one opening.
  let url = new URL('/', location.href).href;
  if (e.notification.data && e.notification.data.url) {
    const path = String(e.notification.data.url);
    url = new URL(legacyRedirectHref(path) ?? path, location.href).href;
  }
  e.waitUntil(
    self.clients.matchAll().then((clients) => {
      for (const client of clients) {
        if (
          client.url === url &&
          'focus' in client &&
          typeof client.focus === 'function'
        ) {
          return client.focus();
        }
      }

      return self.clients.openWindow(url);
    }),
  );
});

let db: IDBPDatabase | null = null;

async function openDatabase() {
  if (!db) {
    db = await openDB('SharedContentDB', 1, {
      upgrade(db) {
        db.createObjectStore('sharedContent', { keyPath: 'id' });
      },
    });
  }
  return db;
}

interface SharedData {
  id: string;
  title: string;
  text: string;
  url: string;
  images?: {
    name: string;
    type: string;
    data: ArrayBuffer;
  }[];
}

registerRoute(
  ({ url }) => url.pathname === '/share-file-handler',
  async ({ request }) => {
    // Get the data from the submitted form.
    const formData = await request.formData();
    const title = formData.get('title') || '';
    const text = formData.get('text') || '';
    const url = formData.get('url') || '';
    const images = formData.getAll('images') as File[];
    await storeSharedData({
      id: 'data',
      title: title as string,
      text: text as string,
      url: url as string,
      images: await Promise.all(
        images.map(async (image) => ({
          name: image.name,
          type: image.type,
          data: await image.arrayBuffer(),
        })),
      ),
    });

    return Response.redirect('/pengumuman/tulis', 303);
  },
  'POST',
);

async function storeSharedData(data: SharedData): Promise<void> {
  const db = await openDatabase();
  await db.put('sharedContent', data);
}

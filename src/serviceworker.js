/**
 * Service worker de jellyfin-web.
 *
 * Solo lo registra el frontend custom en mobile/tablet (shared/pwa.ts);
 * en desktop nunca se registra y nada de este archivo se ejecuta.
 *
 * Estrategias de caché (PWA offline):
 *   - Navegaciones ....... NetworkFirst con fallback al shell cacheado y,
 *                          en último término, a una página offline inline.
 *   - API Jellyfin (GET) . NetworkFirst — datos frescos si hay red, último
 *                          estado conocido si no la hay.
 *   - Imágenes ........... CacheFirst con tope de entradas (las URLs de
 *                          Jellyfin llevan tag: son inmutables de facto).
 *   - Assets estáticos ... StaleWhileRevalidate (js/css/fuentes del bundle).
 *   - Streams A/V ........ NUNCA se interceptan (Range requests, tamaño).
 */

/* eslint-disable-next-line no-restricted-globals -- self es el global del service worker */
const sw = self;

const VERSION = 1;
const SHELL_CACHE = `jfp-shell-v${VERSION}`;
const ASSETS_CACHE = `jfp-assets-v${VERSION}`;
const IMAGES_CACHE = `jfp-images-v${VERSION}`;
const API_CACHE = `jfp-api-v${VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, ASSETS_CACHE, IMAGES_CACHE, API_CACHE];

const IMAGES_MAX_ENTRIES = 300;
const API_MAX_ENTRIES = 200;

const OFFLINE_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sin conexión — Jellyfin</title>
<style>
  body { margin: 0; display: flex; align-items: center; justify-content: center;
         min-height: 100vh; background: #101418; color: #e2e2e5;
         font-family: 'Noto Sans', system-ui, sans-serif; text-align: center; }
  main { padding: 32px; }
  h1 { font-size: 22px; font-weight: 500; margin: 0 0 8px; }
  p { font-size: 14px; opacity: 0.7; margin: 0 0 24px; }
  button { padding: 12px 28px; font-size: 14px; font-weight: 600; border: none;
           border-radius: 999px; background: #a8c8ff; color: #08305f; cursor: pointer; }
</style>
</head>
<body>
<main>
  <h1>Sin conexión</h1>
  <p>No se puede contactar con el servidor Jellyfin.</p>
  <button onclick="location.reload()">Reintentar</button>
</main>
</body>
</html>`;

// ── Utilidades de caché ─────────────────────────────────────────────────

/** Recorta la caché a `maxEntries` borrando las entradas más antiguas. */
function trimCache(cache, maxEntries) {
    if (!maxEntries) return Promise.resolve();
    return cache.keys().then((keys) => {
        if (keys.length <= maxEntries) return null;
        return Promise.all(
            keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key))
        );
    });
}

/** Guarda una copia de la respuesta si es cacheable (2xx no-opaca). */
function cachePut(cacheName, request, response, maxEntries) {
    if (!response || !response.ok) return;
    const copy = response.clone();
    caches.open(cacheName)
        .then((cache) => cache.put(request, copy).then(() => trimCache(cache, maxEntries)))
        .catch(() => null);
}

function cacheFirst(request, cacheName, maxEntries) {
    return caches.match(request).then((hit) => {
        if (hit) return hit;
        return fetch(request).then((response) => {
            cachePut(cacheName, request, response, maxEntries);
            return response;
        });
    });
}

function networkFirst(request, cacheName, maxEntries) {
    return fetch(request)
        .then((response) => {
            cachePut(cacheName, request, response, maxEntries);
            return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || Response.error()));
}

function staleWhileRevalidate(request, cacheName) {
    return caches.match(request).then((hit) => {
        const refresh = fetch(request).then((response) => {
            cachePut(cacheName, request, response);
            return response;
        });
        if (hit) {
            refresh.catch(() => null); // sin red: ya servimos la copia cacheada
            return hit;
        }
        return refresh;
    });
}

function offlineFallback() {
    return new Response(OFFLINE_HTML, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}

function navigationNetworkFirst(request) {
    return fetch(request)
        .then((response) => {
            cachePut(SHELL_CACHE, request, response);
            return response;
        })
        .catch(() => caches.match(request)
            .then((hit) => hit || caches.match('/'))
            .then((hit) => hit || offlineFallback())
        );
}

// ── Clasificación de peticiones ─────────────────────────────────────────

/** Streams de vídeo/audio: Range requests y gigas — el SW no los toca. */
function isMediaStream(url) {
    return /\/(videos|audio)\//i.test(url.pathname)
        || /\.(m3u8|ts|m4s|mp4|mkv|webm|aac|mp3|flac)$/i.test(url.pathname);
}

/** API Jellyfin autenticada (funciona también con el server en otro origen). */
function isApiRequest(request) {
    return request.headers.has('X-Emby-Authorization')
        || (request.headers.get('Authorization') || '').startsWith('MediaBrowser');
}

// ── Ciclo de vida ───────────────────────────────────────────────────────

sw.addEventListener('install', (event) => {
    // Solo '/': el manifest va hasheado a /assets/ en el build (vite
    // reescribe el <link>), y addAll es atómico — un 404 tumbaría también
    // el precache del shell.
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) => cache.addAll(['/']))
            .catch(() => null) // instalable aunque el precache falle
            .then(() => sw.skipWaiting())
    );
});

sw.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key.startsWith('jfp-') && !KNOWN_CACHES.includes(key))
                    .map((key) => caches.delete(key))
            ))
            .then(() => sw.clients.claim())
    );
});

sw.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (isMediaStream(url)) return;

    if (request.mode === 'navigate') {
        event.respondWith(navigationNetworkFirst(request));
        return;
    }

    if (request.destination === 'image') {
        event.respondWith(cacheFirst(request, IMAGES_CACHE, IMAGES_MAX_ENTRIES));
        return;
    }

    if (isApiRequest(request)) {
        event.respondWith(networkFirst(request, API_CACHE, API_MAX_ENTRIES));
        return;
    }

    if (url.origin === sw.location.origin
        && ['script', 'style', 'font', 'worker'].includes(request.destination)) {
        event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE));
    }
    // Todo lo demás pasa directo a la red.
});

// ── Notificaciones (código legacy conservado tal cual) ──────────────────

function getApiClient(serverId) {
    return Promise.resolve(window.connectionManager.getApiClient(serverId));
}

function executeAction(action, data, serverId) {
    return getApiClient(serverId).then(function (apiClient) {
        switch (action) {
            case 'cancel-install':
                return apiClient.cancelPackageInstallation(data.id);
            case 'restart':
                return apiClient.restartServer();
            default:
                clients.openWindow('/');
                return Promise.resolve();
        }
    });
}

sw.addEventListener('notificationclick', function (event) {
    const notification = event.notification;
    notification.close();

    const data = notification.data;
    const serverId = data.serverId;
    const action = event.action;

    if (!action) {
        clients.openWindow('/');
        event.waitUntil(Promise.resolve());
        return;
    }

    event.waitUntil(executeAction(action, data, serverId));
}, false);

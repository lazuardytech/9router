const CACHE_NAME = "9router-image-cache-v1";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 31;
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".ico"];

function isImageRequest(request) {
  if (request.destination === "image") return true;
  const url = new URL(request.url);
  return IMAGE_EXTENSIONS.some((ext) => url.pathname.toLowerCase().endsWith(ext));
}

async function putWithTimestamp(cache, request, response) {
  const headers = new Headers(response.headers);
  headers.set("sw-cache-time", Date.now().toString());
  await cache.put(request, new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !isImageRequest(request)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      const cacheTime = Number(cached.headers.get("sw-cache-time") || 0);
      if (Date.now() - cacheTime < MAX_AGE_MS) return cached;
    }

    try {
      const response = await fetch(request);
      if (response && response.ok) await putWithTimestamp(cache, request, response.clone());
      return response;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  })());
});

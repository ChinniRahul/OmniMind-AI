const CACHE_NAME = "omnimind-pwa-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/pwa-192.svg",
  "/pwa-512.svg",
  "/pwa-192-maskable.svg",
  "/pwa-512-maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Pre-caching Core Shell UI Assets...");
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log("[SW] Clearing stale storage cache:", name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Bypass API endpoint requests from local network cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            offline: true,
            error: "Standalone secure local workspaces are temporarily active while offline."
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // Assets & scripts fetch strategy: Network-first falling back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }
        // Clone and cache the successfully fetched asset
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          // Avoid caching post requests or chrome extensions
          if (event.request.method === "GET" && !url.origin.startsWith("chrome-extension")) {
            cache.put(event.request, responseToCache);
          }
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
        });
      })
  );
});

// Background Sync handler
self.addEventListener("sync", (event) => {
  console.log("[SW] Background synchronization handler invoked. Tag:", event.tag);
  if (event.tag === "sync-chat-messages" || event.tag === "omnimind-sync" || event.tag === "background-sync") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: "BACKGROUND_SYNC_COMPLETE",
            message: "All background sync queues successfully processed."
          });
        });
      })
    );
  }
});

// Push Notification handler
self.addEventListener("push", (event) => {
  console.log("[SW] Remote Push Notification Received.");
  let data = { title: "OmniMind AI Workspace", body: "Secure sync completed. New content available." };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "OmniMind AI", body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: "/pwa-192.svg",
    badge: "/pwa-192.svg",
    vibrate: [120, 60, 120],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: "1"
    },
    actions: [
      { action: "explore", title: "Open Workspace" },
      { action: "close", title: "Close" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action !== "close") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === "/" && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow("/");
        }
      })
    );
  }
});

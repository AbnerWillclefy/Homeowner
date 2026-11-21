/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { notificationFromPush, shouldNavigate, workerLocale } from "./sw/payload";

declare const self: ServiceWorkerGlobalScope;

// Precache the app shell only. No runtime caching: Finances data must never be stored by the worker or served stale.
// This worker registers no handler for API calls (they carry an Authorization header) nor for the cross-origin
// cognito-idp calls. The only routes are the precache, which answers just the build's own files, and the
// navigation route below. Do not add a catch-all route or a fetch listener without excluding both, or tokens,
// passwords and Finances data could be cached or replayed.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Single-page app: serve the precached shell for navigations, so deep links and a cold offline start work.
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// A new worker takes over as soon as it installs, so nobody stays on an old version.
self.addEventListener("install", () => {
  void self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Every push must show a notification, whatever the payload looks like, or iOS revokes the subscription.
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let text: string | null = null;
      try {
        text = event.data ? event.data.text() : null;
      } catch {
        text = null;
      }
      const { title, body, url } = notificationFromPush(text, workerLocale(self.navigator.languages ?? []));
      await self.registration.showNotification(title, { body, icon: "/icon-192.png", data: { url } });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: unknown } | null;
  const path = typeof data?.url === "string" ? data.url : "/";
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = open[0];
      const target = new URL(path, self.location.origin).href;
      if (existing) {
        await existing.focus();
        // Not every browser has navigate(), and it can reject; focusing the window already did the job.
        if (shouldNavigate(existing.url, path, self.location.origin) && typeof existing.navigate === "function") {
          try {
            await existing.navigate(target);
          } catch {
            // Focus-only.
          }
        }
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

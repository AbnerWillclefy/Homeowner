/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { browserLanguages } from "./shared/i18n/browserLanguages";
import { DEFAULT_LOCALE, type Locale } from "./shared/i18n/locales";
import { resolveLocale } from "./shared/i18n/resolveLocale";
import { notificationFromPush, shouldNavigate } from "./sw/payload";

declare const self: ServiceWorkerGlobalScope;

// Precache the app shell only. No runtime caching: API responses must never be served stale.
// Sign-in relies on this: this worker registers no handler for API calls (which carry an Authorization
// header) nor for the cross-origin cognito-idp calls. The only routes are the precache, which answers just
// the build's own files, and the navigation route below. Do not add a catch-all route or a fetch listener
// without excluding both, or tokens and passwords could be cached or replayed.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Single-page app: serve the precached shell for navigations.
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// autoUpdate: a new worker takes over as soon as it installs.
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
      // Device language, resolved per push. The in-app choice is not readable here (no localStorage in workers).
      let locale: Locale = DEFAULT_LOCALE;
      try {
        locale = resolveLocale({ languages: browserLanguages() });
      } catch {
        locale = DEFAULT_LOCALE;
      }
      const { title, body, url } = notificationFromPush(text, locale);
      await self.registration.showNotification(title, {
        body,
        icon: "/icon-192.png",
        data: { url },
      });
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
        // A window left on another tab should land on the target. Not every browser has navigate(), and it can
        // reject; the notification still did its job by focusing the window, so fall back to that.
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

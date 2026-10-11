import type { Locale } from "./locales";

// The notification of last resort, shown by the service worker when a push has no usable title.
// Deliberately outside the catalogs: the worker imports this file and must not pull the catalogs in.
// Keep this file's only import `./locales` (fallback.test.ts enforces it).
export const FALLBACK: Record<Locale, { title: string; body: string }> = {
  "en-US": { title: "Homeowner", body: "You have a new update." },
  "pt-BR": { title: "Homeowner", body: "Você tem uma nova atualização." },
};

import type { Locale } from "./locales";

// The notification of last resort, shown by the service worker when a push has no usable title.
// Deliberately outside the catalogs: the worker imports this file and must not pull the catalogs in.
// Keep this file's only import `./locales` (fallback.test.ts enforces it).
export const FALLBACK: Record<Locale, { title: string; body: string }> = {
  "en-US": { title: "Homeowner", body: "You have a new update." },
  "pt-BR": { title: "Homeowner", body: "Você tem uma nova atualização." },
};

export type NotificationKind = "checkin_reminder" | "day_plan_ready";

// The text for the push kinds the server names (`kind` in the push payload). The server sends English
// text too, but it has no per-User language, so the worker words these for the device language.
// Generic on purpose: no names or Task titles. Wording follows docs/glossary-pt-BR.md.
export const KIND_TEXT: Record<NotificationKind, Record<Locale, { title: string; body: string }>> = {
  checkin_reminder: {
    "en-US": {
      title: "Time to check in",
      body: "Tell Homeowner how you feel today so your tasks fit your energy.",
    },
    "pt-BR": {
      title: "Hora do check-in",
      body: "Conte ao Homeowner como você está hoje para que suas tarefas combinem com a sua energia.",
    },
  },
  day_plan_ready: {
    "en-US": { title: "Your Day Plan is ready", body: "See what is on your plate today." },
    "pt-BR": { title: "Seu plano do dia está pronto", body: "Veja o que está na sua lista hoje." },
  },
};

export function isNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(KIND_TEXT, value);
}

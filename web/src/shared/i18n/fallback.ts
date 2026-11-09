import type { Locale } from "./locales";

// The notification of last resort, shown by the service worker when a push has no usable title.
// Deliberately outside the catalogs: the worker imports this file and must not pull the catalogs in.
// Keep this file's only import `./locales` (fallback.test.ts enforces it).
export const FALLBACK: Record<Locale, { title: string; body: string }> = {
  "en-US": { title: "Homeowner", body: "You have a new update." },
  "pt-BR": { title: "Homeowner", body: "Você tem uma nova atualização." },
};

export type NotificationKind = "checkin_reminder" | "day_plan_ready" | "bill_due_today" | "bill_due_soon" | "bill_overdue";

// The text for the push kinds the server names (`kind` in the push payload). The server sends English
// text too, but it has no per-User language, so the worker words these for the device language.
// Generic on purpose: no names or Task titles. Wording follows docs/glossary-pt-BR.md.
export const KIND_TEXT: Record<NotificationKind, Record<Locale, { title: string; body: string }>> = {
  checkin_reminder: {
    "en-US": {
      title: "Time to check in",
      body: "Tell Homeowner how you feel today.",
    },
    "pt-BR": {
      title: "Hora do check-in",
      body: "Conte ao Homeowner como você está hoje.",
    },
  },
  day_plan_ready: {
    "en-US": { title: "Your Day Plan is ready", body: "See what is on your plate today." },
    "pt-BR": { title: "Seu plano do dia está pronto", body: "Veja o que está na sua lista hoje." },
  },
  bill_due_today: {
    "en-US": { title: "A bill to pay is due today", body: "Open Homeowner to see which one." },
    "pt-BR": { title: "Conta a pagar vence hoje", body: "Abra o Homeowner para ver qual." },
  },
  bill_due_soon: {
    "en-US": { title: "A bill to pay is due tomorrow", body: "Open Homeowner to see which one." },
    "pt-BR": { title: "Uma conta a pagar vence amanhã", body: "Abra o Homeowner para ver qual." },
  },
  bill_overdue: {
    "en-US": { title: "A bill to pay is still open", body: "Open Homeowner to see which one." },
    "pt-BR": { title: "Uma conta a pagar está em aberto", body: "Abra o Homeowner para ver qual." },
  },
};

export function isNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(KIND_TEXT, value);
}

// Copied from web/src/sw/payload.ts, not imported: web/ is not a dependency of revenue/. The worker cannot pull in
// the i18n catalogs, so the few texts it needs live here. Wording follows docs/glossary-pt-BR.md.
export type WorkerLocale = "pt-BR" | "en";
type Text = { title: string; body: string };

export interface NotificationContent extends Text {
  /** A same-origin path to open when the notification is tapped. */
  url: string;
}

/** The notification of last resort: iOS revokes a subscription whose pushes show nothing. */
export const FALLBACK: Record<WorkerLocale, Text> = {
  "pt-BR": { title: "Revenue", body: "Você tem uma nova atualização." },
  en: { title: "Revenue", body: "You have a new update." },
};

// The Bill reminder kinds, and no others: any other kind (Homeowner's) gets the fallback.
export const KIND_TEXT = {
  bill_due_today: {
    "pt-BR": { title: "Conta a pagar vence hoje", body: "Abra o Revenue para ver qual." },
    en: { title: "A bill to pay is due today", body: "Open Revenue to see which one." },
  },
  bill_due_soon: {
    "pt-BR": { title: "Uma conta a pagar vence amanhã", body: "Abra o Revenue para ver qual." },
    en: { title: "A bill to pay is due tomorrow", body: "Open Revenue to see which one." },
  },
  bill_overdue: {
    "pt-BR": { title: "Uma conta a pagar está em aberto", body: "Abra o Revenue para ver qual." },
    en: { title: "A bill to pay is still open", body: "Open Revenue to see which one." },
  },
} as const satisfies Record<string, Record<WorkerLocale, Text>>;

const BILLS = "/bills";

/** English only when the device prefers it, else pt-BR (the in-app choice is not readable in a worker). */
export function workerLocale(languages: readonly string[]): WorkerLocale {
  return languages[0]?.toLowerCase().startsWith("en") ? "en" : "pt-BR";
}

function safePath(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : BILLS;
}

/**
 * Whether a window already open at `clientUrl` should be navigated to `target` (a same-origin path) when a
 * notification is tapped. False when it is already there, on another origin, or when a URL cannot be read.
 */
export function shouldNavigate(clientUrl: string, target: string, origin: string): boolean {
  try {
    const current = new URL(clientUrl);
    const wanted = new URL(target, origin);
    if (current.origin !== wanted.origin) return false;
    return current.pathname !== wanted.pathname || current.search !== wanted.search;
  } catch {
    return false;
  }
}

/** Turns a push payload into something to show. It never fails: empty, broken or foreign payloads give the fallback. */
export function notificationFromPush(text: string | null, locale: WorkerLocale = "pt-BR"): NotificationContent {
  const fallback = { ...FALLBACK[locale], url: "/" };
  if (!text) return fallback;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fallback;
  }
  if (typeof data !== "object" || data === null) return fallback;
  const { kind, url } = data as Record<string, unknown>;
  if (typeof kind !== "string" || !Object.hasOwn(KIND_TEXT, kind)) return fallback;
  return { ...KIND_TEXT[kind as keyof typeof KIND_TEXT][locale], url: safePath(url) };
}

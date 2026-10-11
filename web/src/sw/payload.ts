import { FALLBACK } from "../i18n/fallback";
import { DEFAULT_LOCALE, type Locale } from "../i18n/locales";

export interface NotificationContent {
  title: string;
  body: string;
  /** A same-origin path to open when the notification is tapped. */
  url: string;
}

function safePath(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/**
 * Turns a push payload into something to show. It never fails: iOS revokes a
 * subscription whose pushes do not show a notification, so empty or broken
 * payloads still produce one. The fallback text is in `locale`; a valid payload
 * passes through untouched, whatever the locale.
 */
export function notificationFromPush(text: string | null, locale: Locale = DEFAULT_LOCALE): NotificationContent {
  const fallback: NotificationContent = { ...FALLBACK[locale], url: "/" };
  if (!text) return fallback;

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fallback;
  }
  if (typeof data !== "object" || data === null) return fallback;

  const { title, body, url } = data as Record<string, unknown>;
  if (typeof title !== "string" || title === "") return fallback;
  return { title, body: typeof body === "string" ? body : "", url: safePath(url) };
}

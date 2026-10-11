export const FALLBACK_TITLE = "Homeowner";
export const FALLBACK_BODY = "You have a new update.";

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
 * payloads still produce one.
 */
export function notificationFromPush(text: string | null): NotificationContent {
  const fallback: NotificationContent = { title: FALLBACK_TITLE, body: FALLBACK_BODY, url: "/" };
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

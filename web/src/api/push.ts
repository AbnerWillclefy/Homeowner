import { config } from "../config";

/** The browser's PushSubscription.toJSON() shape, as the API expects it. */
export interface SubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type VapidKeyResult = { kind: "ok"; key: string } | { kind: "not-configured" } | { kind: "error" };
export type SaveResult = { kind: "ok" } | { kind: "error" };
export type TestResult =
  | { kind: "ok" }
  /** The API does not know this device's subscription. */
  | { kind: "unknown" }
  /** The push service rejected the subscription; the API dropped it. */
  | { kind: "gone" }
  | { kind: "push-service-error" }
  | { kind: "error" };

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function getVapidPublicKey(): Promise<VapidKeyResult> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/push/vapid-public-key`, { cache: "no-store" });
    if (res.status === 503) return { kind: "not-configured" };
    if (!res.ok) return { kind: "error" };
    const body: unknown = await res.json();
    const key = (body as { key?: unknown } | null)?.key;
    return typeof key === "string" && key !== "" ? { kind: "ok", key } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

/** Idempotent: safe to call on every launch. */
export async function saveSubscription(sub: SubscriptionJSON, userAgent: string): Promise<SaveResult> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/push/subscription`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys, userAgent }),
    });
    return res.status === 204 ? { kind: "ok" } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

export async function sendTestNotification(endpoint: string): Promise<TestResult> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/push/test`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ endpoint }),
    });
    switch (res.status) {
      case 204:
        return { kind: "ok" };
      case 404:
        return { kind: "unknown" };
      case 410:
        return { kind: "gone" };
      case 502:
        return { kind: "push-service-error" };
      default:
        return { kind: "error" };
    }
  } catch {
    return { kind: "error" };
  }
}

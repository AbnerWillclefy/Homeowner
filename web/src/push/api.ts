import { config } from "../config";
import { authedFetch } from "../shared/api/request";

/** The browser's PushSubscription.toJSON() shape, as the API expects it. */
export interface SubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type VapidKeyResult = { kind: "ok"; key: string } | { kind: "not-configured" } | { kind: "error" };
/** "not-signed-in": there is no session, or it was turned down; the person must sign in again. */
export type SaveResult = { kind: "ok" } | { kind: "not-signed-in" } | { kind: "error" };

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
    const result = await authedFetch("/push/subscription", {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys, userAgent }),
    });
    if (result.kind === "not-signed-in") return result;
    return result.response.status === 204 ? { kind: "ok" } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

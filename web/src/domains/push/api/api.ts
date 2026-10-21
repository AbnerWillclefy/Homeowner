import { httpClient } from "../../../shared/api/http";
import { authedRequest } from "../../auth/api/client";

/** The browser's PushSubscription.toJSON() shape, as the API expects it. */
export interface SubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type VapidKeyResult = { kind: "ok"; key: string } | { kind: "not-configured" } | { kind: "error" };
/** "not-signed-in": there is no session, or it was turned down; the person must sign in again. */
export type SaveResult = { kind: "ok" } | { kind: "not-signed-in" } | { kind: "error" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function getVapidPublicKey(): Promise<VapidKeyResult> {
  try {
    const res = await httpClient.get("/push/vapid-public-key", { fetchOptions: { cache: "no-store" } });
    if (res.status === 503) return { kind: "not-configured" };
    if (res.status !== 200) return { kind: "error" };
    const body: unknown = res.data;
    const key = isRecord(body) ? body.key : undefined;
    return typeof key === "string" && key !== "" ? { kind: "ok", key } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

/** Idempotent: safe to call on every launch. */
export async function saveSubscription(sub: SubscriptionJSON, userAgent: string): Promise<SaveResult> {
  try {
    const result = await authedRequest({
      url: "/push/subscription",
      method: "PUT",
      data: { endpoint: sub.endpoint, keys: sub.keys, userAgent },
    });
    if (result.kind === "not-signed-in") return result;
    return result.response.status === 204 ? { kind: "ok" } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

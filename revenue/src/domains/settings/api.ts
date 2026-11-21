import type { AxiosRequestConfig } from "axios";
import { apiClient, NotSignedIn } from "../../api/client";
import { send, writeResult, type WriteResult } from "../../api/write";
import { getCommitments } from "../overview/api/api";
import { saoPauloDay } from "../overview/logic/today";

export type { WriteResult } from "../../api/write";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** `GET /me/finance/commitments`: there is no read for the income alone. Null when none is set. */
export async function getMonthlyIncome(): Promise<number | null> {
  return (await getCommitments(saoPauloDay(new Date()).slice(0, 7))).monthlyIncomeCents;
}

/** `GET /me/finance`: whether Pluggy credentials are saved. Never the credentials themselves. */
export async function getCredentialsSaved(): Promise<boolean> {
  const response = await apiClient.get("/me/finance");
  if (response.status !== 200 || !isRecord(response.data) || typeof response.data.configured !== "boolean") throw new Error(`GET /me/finance answered ${response.status}`);
  return response.data.configured;
}

/** `PUT /me/finance/income`; null clears it. */
export const putIncome = async (monthlyIncomeCents: number | null): Promise<WriteResult> =>
  writeResult(await send(apiClient, "PUT", "/me/finance/income", 204, { monthlyIncomeCents }), 204);

/** 400 the API refused the shape; 422 Pluggy turned the credentials down. */
export type CredentialsResult = { kind: "ok" } | { kind: "invalid" } | { kind: "rejected" } | { kind: "error" };

/** The values go in the request body and nowhere else: not the URL, not a cache, not a log. */
export async function putCredentials(clientId: string, clientSecret: string): Promise<CredentialsResult> {
  try {
    const { status } = await apiClient.put("/me/finance/credentials", { clientId, clientSecret });
    return status === 204 ? { kind: "ok" } : status === 400 ? { kind: "invalid" } : status === 422 ? { kind: "rejected" } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

export const deleteCredentials = async (): Promise<WriteResult> => writeResult(await send(apiClient, "DELETE", "/me/finance/credentials", 204), 204);

/** `DELETE /me/finance`: every finance table of the User. The banks stay connected at Pluggy. */
export const deleteFinanceData = async (): Promise<WriteResult> => writeResult(await send(apiClient, "DELETE", "/me/finance", 204), 204);

/** The browser's PushSubscription.toJSON() shape, as the API expects it. */
export interface SubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type VapidKeyResult = { kind: "ok"; key: string } | { kind: "not-configured" } | { kind: "error" };
/** "not-signed-in": there is no usable session; the person must sign in again. */
export type PushWriteResult = { kind: "ok" } | { kind: "not-signed-in" } | { kind: "error" };

/** `GET /push/vapid-public-key`: 503 while VAPID is not configured. */
export async function getVapidPublicKey(): Promise<VapidKeyResult> {
  try {
    const response = await apiClient.get("/push/vapid-public-key");
    if (response.status === 503) return { kind: "not-configured" };
    const key = isRecord(response.data) ? response.data.key : undefined;
    return response.status === 200 && typeof key === "string" && key !== "" ? { kind: "ok", key } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

async function pushRequest(config: AxiosRequestConfig): Promise<PushWriteResult> {
  try {
    return (await apiClient.request(config)).status === 204 ? { kind: "ok" } : { kind: "error" };
  } catch (error) {
    return error instanceof NotSignedIn ? { kind: "not-signed-in" } : { kind: "error" };
  }
}

/** `PUT /push/subscription`, idempotent: safe on every launch. `app` tells the API these are Revenue's notifications. */
export const saveSubscription = (sub: SubscriptionJSON, userAgent: string): Promise<PushWriteResult> =>
  pushRequest({ url: "/push/subscription", method: "PUT", data: { endpoint: sub.endpoint, keys: sub.keys, userAgent, app: "revenue" } });

/** `DELETE /push/subscription` by endpoint, so nothing stays registered on the server. */
export const deleteSubscription = (endpoint: string): Promise<PushWriteResult> =>
  pushRequest({ url: "/push/subscription", method: "DELETE", data: { endpoint } });

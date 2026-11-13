import type { AxiosResponse } from "axios";
import { apiClient, NotSignedIn } from "../../api/client";
import { fieldsOf, type FieldCodes } from "../../api/write";

/** One bank account or card. `balanceCents` and `balanceOn` are both absent for a card and for a bank account never synced. */
export interface Source {
  id: string;
  /** The display name, or the bank's when none is set. */
  name: string;
  bankName: string;
  kind: string;
  closeDay: number | null;
  dueDay: number | null;
  balanceCents?: number;
  /** `YYYY-MM-DD`: the day the balance was read. */
  balanceOn?: string;
}

/** `GET /me/finance`, the parts this screen uses. Never carries the credentials. */
export interface SourcesStatus {
  sources: Source[];
  /** True while any bank has not finished its first import. */
  importing: boolean;
  /** RFC 3339, or null while any bank has never synced. */
  lastSyncedAt: string | null;
}

export type FailureKind = "not-signed-in" | "offline" | "error" | "rejected" | "item-refused" | "no-credentials" | "unavailable";
type Failure = { kind: FailureKind };
export type ConnectTokenResult = { kind: "ok"; connectToken: string; includeSandbox: boolean } | Failure;
export type StatusResult = { kind: "ok"; status: SourcesStatus } | Failure;
export type NameResult = { kind: "ok" } | { kind: "fields"; fields: FieldCodes } | Failure;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const day = (v: unknown): v is number | null => v === null || Number.isInteger(v);

/** Null for a body that does not fit. A balance needs both its keys; one alone is malformed. */
export function parseStatus(body: unknown): SourcesStatus | null {
  if (!isRecord(body) || !Array.isArray(body.sources)) return null;
  // shortcut: an absent `importing` or `lastSyncedAt` reads as idle and never synced, so the screenshot fake (no such keys) still renders; drop when it sends them.
  const { importing = false, lastSyncedAt = null } = body;
  if (typeof importing !== "boolean" || (lastSyncedAt !== null && typeof lastSyncedAt !== "string")) return null;
  const sources: Source[] = [];
  for (const s of body.sources) {
    if (!isRecord(s) || typeof s.id !== "string" || typeof s.name !== "string" || typeof s.kind !== "string") return null;
    const { closeDay = null, dueDay = null, balanceCents, balanceOn } = s;
    if (!day(closeDay) || !day(dueDay) || (balanceCents === undefined) !== (balanceOn === undefined)) return null;
    if (balanceCents !== undefined && (!Number.isInteger(balanceCents) || typeof balanceOn !== "string")) return null;
    sources.push({
      id: s.id, name: s.name, bankName: typeof s.bankName === "string" ? s.bankName : s.name, kind: s.kind,
      closeDay, dueDay,
      ...(balanceCents !== undefined && { balanceCents: balanceCents as number, balanceOn: balanceOn as string }),
    });
  }
  return { sources, importing, lastSyncedAt };
}

/** `GET /me/finance`. Throws on any failure, so a query shows its error state. */
export async function getSources(): Promise<SourcesStatus> {
  const response = await apiClient.get("/me/finance");
  const status = response.status === 200 ? parseStatus(response.data) : null;
  if (!status) throw new Error(`GET /me/finance answered ${response.status}`);
  return status;
}

function failureOf(response: AxiosResponse): FailureKind {
  const code = isRecord(response.data) ? response.data.error : undefined;
  switch (response.status) {
    case 409: return "no-credentials";
    case 422: return code === "pluggy_credentials_rejected" ? "rejected" : "item-refused";
    case 502: return "unavailable";
    default: return "error";
  }
}

async function call(method: string, url: string, expected: number, data?: unknown): Promise<{ response: AxiosResponse } | Failure> {
  try {
    const response = await apiClient.request({ method, url, data });
    return response.status === expected ? { response } : { kind: failureOf(response) };
  } catch (error) {
    return { kind: error instanceof NotSignedIn ? "not-signed-in" : "offline" };
  }
}

/** `POST /me/finance/connect-token`: 409 means no saved credentials; 422 `pluggy_credentials_rejected`; 502 Pluggy is down. */
export async function createConnectToken(): Promise<ConnectTokenResult> {
  const result = await call("POST", "/me/finance/connect-token", 200);
  if ("kind" in result) return result;
  const { connectToken, includeSandbox } = isRecord(result.response.data) ? result.response.data : {};
  return typeof connectToken === "string" && connectToken !== "" && typeof includeSandbox === "boolean" ? { kind: "ok", connectToken, includeSandbox } : { kind: "error" };
}

/** `POST /me/finance/items`: registers the Item the widget made; the answer is the status again. 422 means Pluggy could not log in, or the Item has no supported account. */
export async function registerItem(itemId: string): Promise<StatusResult> {
  const result = await call("POST", "/me/finance/items", 200, { itemId });
  if ("kind" in result) return result;
  const status = parseStatus(result.response.data);
  return status ? { kind: "ok", status } : { kind: "error" };
}

/** `PUT /me/finance/sources/{id}/name`; null goes back to the bank's name. A 400 carries `fields.name`. */
export async function putSourceName(sourceId: string, name: string | null): Promise<NameResult> {
  try {
    const response = await apiClient.put(`/me/finance/sources/${encodeURIComponent(sourceId)}/name`, { name });
    if (response.status === 204) return { kind: "ok" };
    const fields = response.status === 400 ? fieldsOf(response) : null;
    return fields ? { kind: "fields", fields } : { kind: failureOf(response) };
  } catch (error) {
    return { kind: error instanceof NotSignedIn ? "not-signed-in" : "offline" };
  }
}

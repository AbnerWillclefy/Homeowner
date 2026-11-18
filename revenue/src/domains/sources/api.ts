import type { AxiosResponse } from "axios";
import { apiClient, NotSignedIn } from "../../api/client";
import { fieldsOf, saveRow, send, writeResult, type FieldCodes, type SaveResult, type WriteResult } from "../../api/write";

/** One bank account or card. `balanceCents` and `balanceOn` are both absent for a card, for a non-BRL account (the API reads no balance for it) and for a bank account never synced. */
export interface Source {
  id: string;
  /** The display name, or the bank's when none is set. */
  name: string;
  bankName: string;
  kind: string;
  currency: string;
  closeDay: number | null;
  dueDay: number | null;
  balanceCents?: number;
  /** `YYYY-MM-DD`: the day the balance was read. */
  balanceOn?: string;
  /** A card's limit as its bank reports it; absent on any other kind and on a card whose bank gives none. */
  creditLimitCents?: number;
}

/** One bank connection: `reconnect` means the bank asked for a new authorization. `bankName` is null until its first read. */
export interface BankItem {
  id: string;
  bankName: string | null;
  status: "ok" | "reconnect";
  /** How many Sources the connection holds. */
  products: number;
}

/** `GET /me/finance`, the parts this screen uses. Never carries the credentials. */
export interface SourcesStatus {
  sources: Source[];
  items: BankItem[];
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
  // An older API during a deploy sends no `items`: an empty list hides the card.
  const { items: rawItems = [] } = body;
  if (!Array.isArray(rawItems)) return null;
  const items: BankItem[] = [];
  for (const i of rawItems) {
    if (!isRecord(i) || typeof i.id !== "string" || (i.status !== "ok" && i.status !== "reconnect") || !Number.isInteger(i.products)) return null;
    items.push({ id: i.id, bankName: typeof i.bankName === "string" ? i.bankName : null, status: i.status, products: i.products as number });
  }
  const sources: Source[] = [];
  for (const s of body.sources) {
    if (!isRecord(s) || typeof s.id !== "string" || typeof s.name !== "string" || typeof s.kind !== "string" || typeof s.currency !== "string") return null;
    const { closeDay = null, dueDay = null, balanceCents, balanceOn, creditLimitCents } = s;
    if (creditLimitCents !== undefined && !Number.isInteger(creditLimitCents)) return null;
    if (!day(closeDay) || !day(dueDay) || (balanceCents === undefined) !== (balanceOn === undefined)) return null;
    if (balanceCents !== undefined && (!Number.isInteger(balanceCents) || typeof balanceOn !== "string")) return null;
    sources.push({
      id: s.id, name: s.name, bankName: typeof s.bankName === "string" ? s.bankName : s.name, kind: s.kind, currency: s.currency,
      closeDay, dueDay,
      ...(balanceCents !== undefined && { balanceCents: balanceCents as number, balanceOn: balanceOn as string }),
      ...(creditLimitCents !== undefined && { creditLimitCents: creditLimitCents as number }),
    });
  }
  return { sources, items, importing, lastSyncedAt };
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

/** A card with no bank connection: the User types its bill for each of the next 12 months. */
export interface ManualCard {
  id: string;
  name: string;
  /** 1 to 31. */
  dueDay: number;
  /** The name a Pix to this card's bill carries, as on the receipt; null when none. */
  pixRecipient: string | null;
  /** Every typed month: `YYYY-MM` to cents. A month not here repeats the latest typed one before it. */
  bills: Record<string, number>;
}

/** The body of a write. A month set to null is cleared; a month left out is kept. */
export interface ManualCardInput {
  name: string;
  dueDay: number;
  pixRecipient: string | null;
  bills: Record<string, number | null>;
}

function parseManualCard(v: unknown): ManualCard | null {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.name !== "string" || !Number.isInteger(v.dueDay)) return null;
  if ((v.pixRecipient !== null && typeof v.pixRecipient !== "string") || !isRecord(v.bills)) return null;
  const months = Object.entries(v.bills);
  if (months.some(([month, cents]) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(cents))) return null;
  return { id: v.id, name: v.name, dueDay: v.dueDay as number, pixRecipient: v.pixRecipient, bills: v.bills as Record<string, number> };
}

/** `GET /me/finance/manual-cards`, ordered by name. Throws on any failure, so a query shows its error state. */
export async function getManualCards(): Promise<ManualCard[]> {
  const response = await apiClient.get("/me/finance/manual-cards");
  const rows = response.status === 200 && isRecord(response.data) && Array.isArray(response.data.cards) ? response.data.cards.map(parseManualCard) : null;
  if (!rows || rows.some((c) => c === null)) throw new Error(`GET /me/finance/manual-cards answered ${response.status}`);
  return rows as ManualCard[];
}

/** `POST /me/finance/manual-cards`, or `PUT .../{id}` with an id. A 400 carries field codes (`bills` is `invalid_month` or `invalid`). */
export const saveManualCard = (id: string | null, input: ManualCardInput): Promise<SaveResult> => saveRow(apiClient, "/me/finance/manual-cards", id, input);

/** `DELETE /me/finance/manual-cards/{id}`; its typed bills go with it. */
export async function deleteManualCard(id: string): Promise<WriteResult> {
  return writeResult(await send(apiClient, "DELETE", `/me/finance/manual-cards/${encodeURIComponent(id)}`, 204), 204);
}

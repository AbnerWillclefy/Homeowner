import type { AxiosInstance } from "axios";
import { apiClient } from "../../api/client";
import { send, writeResult, type FieldCodes, type WriteResult } from "../../api/write";
import { readList } from "../bills/api";

export type { FieldCodes, WriteResult } from "../../api/write";

export type PantryState = "in_stock" | "ran_out";

/** One Pantry item, as `GET /me/finance/pantry` lists it. */
export interface PantryItem {
  id: string;
  name: string;
  preferredBrand: string | null;
  /** "Always buy": the item stays on every shopping list. */
  fixed: boolean;
  state: PantryState;
  /** `YYYY-MM-DD` in São Paulo; set only while `state` is `ran_out`. */
  ranOutOn: string | null;
}

/** What `PATCH` takes: a missing key is left alone and a null brand clears it. */
export interface PantryPatch {
  name?: string;
  preferredBrand?: string | null;
  fixed?: boolean;
}

/** A save: the item went through, one of its fields was refused (a 409 `name_taken` is `{ name: "taken" }`), or it failed. */
export type PantrySave = WriteResult | { kind: "fields"; fields: FieldCodes };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function parseItem(v: unknown): PantryItem | null {
  if (!isRecord(v)) return null;
  const { id, name, preferredBrand, fixed, state, ranOutOn } = v;
  if (typeof id !== "string" || typeof name !== "string" || typeof fixed !== "boolean") return null;
  if (state !== "in_stock" && state !== "ran_out") return null;
  if (preferredBrand !== undefined && preferredBrand !== null && typeof preferredBrand !== "string") return null;
  if (ranOutOn !== undefined && ranOutOn !== null && typeof ranOutOn !== "string") return null;
  return { id, name, preferredBrand: preferredBrand ?? null, fixed, state, ranOutOn: ranOutOn ?? null };
}

/** `GET /me/finance/pantry`. Throws on any failure, so a query shows its error state. */
export const getPantry = (client: AxiosInstance = apiClient) =>
  readList(client, "/me/finance/pantry", undefined, (b) => (isRecord(b) ? b.items : null), parseItem);

const conflict = (response: Awaited<ReturnType<typeof send>>, code: string) =>
  response?.status === 409 && isRecord(response.data) && response.data.error === code;

async function save(client: AxiosInstance, method: string, url: string, ok: number, body: unknown): Promise<PantrySave> {
  const response = await send(client, method, url, ok, body);
  return conflict(response, "name_taken") ? { kind: "fields", fields: { name: "taken" } } : writeResult(response, ok);
}

const itemUrl = (id: string) => `/me/finance/pantry/items/${encodeURIComponent(id)}`;

/** `POST /me/finance/pantry/items`. */
export const addItem = (name: string, preferredBrand: string | null = null, client: AxiosInstance = apiClient) =>
  save(client, "POST", "/me/finance/pantry/items", 201, { name, preferredBrand });

/** `PATCH /me/finance/pantry/items/{id}`. */
export const updateItem = (id: string, patch: PantryPatch, client: AxiosInstance = apiClient) => save(client, "PATCH", itemUrl(id), 200, patch);

/** `DELETE /me/finance/pantry/items/{id}`; its history goes with it. */
export const deleteItem = async (id: string, client: AxiosInstance = apiClient): Promise<WriteResult> =>
  writeResult(await send(client, "DELETE", itemUrl(id), 204), 204);

/** `POST .../run-outs`: the item ran out today. Repeating it is harmless. */
export const markRanOut = async (id: string, client: AxiosInstance = apiClient): Promise<WriteResult> =>
  writeResult(await send(client, "POST", `${itemUrl(id)}/run-outs`, 204), 204);

/** `DELETE .../run-outs/latest`. A 409 `not_ran_out` means it is already back in stock, which is what was asked. */
export const undoRanOut = async (id: string, client: AxiosInstance = apiClient): Promise<WriteResult> => {
  const response = await send(client, "DELETE", `${itemUrl(id)}/run-outs/latest`, 204);
  return conflict(response, "not_ran_out") ? { kind: "ok" } : writeResult(response, 204);
};

/** One line of a receipt. `itemId` is set once it is matched to an item; `ignored` once it is marked "not a pantry item". */
export interface ReceiptLine {
  /** 1-based position; the path of `matchLine`. */
  n: number;
  description: string;
  /** Thousandths of `unit`: 1500 is 1,5 kg. */
  quantityMilli: number;
  unit: string;
  unitPriceCents: number;
  totalCents: number;
  itemId: string | null;
  ignored: boolean;
}

/** A receipt as `POST pantry/receipts` and `PUT .../lines/{n}` answer it. */
export interface Receipt {
  id: string;
  storeName: string;
  /** `YYYY-MM-DD`. */
  issuedOn: string;
  totalCents: number;
  readBy: string;
  lines: ReceiptLine[];
}

/**
 * Adding a receipt: read now (201), already saved (200), the code refused (400 `invalid_code`), SEFAZ or the User's
 * state cannot be read (502 `sefaz_unavailable`, 422 `unsupported_state`: both offer the photo), or anything else.
 */
export type AddReceiptResult =
  | { kind: "created" | "duplicate"; receipt: Receipt }
  | { kind: "invalid" }
  | { kind: "unavailable" }
  | { kind: "error" };

/** How one line is matched: to an item, to a new item, or "not a pantry item". */
export type MatchChoice = { itemId: string } | { newItem: { name: string; brand: string | null } } | { ignore: true };

/** A match: the receipt as it is now, a refused name (409 `name_taken` is `{ name: "taken" }`), a receipt or line that is gone, or a failure. */
export type MatchResult = { kind: "ok"; receipt: Receipt } | { kind: "fields"; fields: FieldCodes } | { kind: "not-found" } | { kind: "error" };

const isInt = (v: unknown): v is number => Number.isSafeInteger(v);

function parseLine(v: unknown): ReceiptLine | null {
  if (!isRecord(v)) return null;
  const { n, description, quantityMilli, unit, unitPriceCents, totalCents, itemId, ignored } = v;
  if (!isInt(n) || n < 1 || typeof description !== "string" || !isInt(quantityMilli) || typeof unit !== "string") return null;
  if (!isInt(unitPriceCents) || !isInt(totalCents) || typeof ignored !== "boolean") return null;
  if (itemId !== undefined && itemId !== null && typeof itemId !== "string") return null;
  return { n, description, quantityMilli, unit, unitPriceCents, totalCents, itemId: itemId ?? null, ignored };
}

function parseReceipt(v: unknown): Receipt | null {
  if (!isRecord(v)) return null;
  const { id, storeName, issuedOn, totalCents, readBy, lines } = v;
  if (typeof id !== "string" || typeof storeName !== "string" || typeof issuedOn !== "string" || !isInt(totalCents) || typeof readBy !== "string") return null;
  if (!Array.isArray(lines)) return null;
  const parsed = lines.map(parseLine);
  return parsed.every((l) => l !== null) ? { id, storeName, issuedOn, totalCents, readBy, lines: parsed } : null;
}

const errorCode = (data: unknown) => (isRecord(data) && typeof data.error === "string" ? data.error : null);

/** `POST /me/finance/pantry/receipts` with the pasted or scanned text; the server reads the key out of it. */
export async function addReceipt(code: string, client: AxiosInstance = apiClient): Promise<AddReceiptResult> {
  let response;
  try {
    response = await client.request({ method: "POST", url: "/me/finance/pantry/receipts", data: { code } });
  } catch {
    return { kind: "error" };
  }
  const { status, data } = response;
  if (status === 400 && errorCode(data) === "invalid_code") return { kind: "invalid" };
  if (status === 502 || status === 422) return { kind: "unavailable" };
  const receipt = status === 200 || status === 201 ? parseReceipt(data) : null;
  return receipt ? { kind: status === 201 ? "created" : "duplicate", receipt } : { kind: "error" };
}

/** `PUT /me/finance/pantry/receipts/{id}/lines/{n}`: written as soon as it is chosen, so nothing is lost if the Sheet closes. */
export async function matchLine(receiptId: string, n: number, choice: MatchChoice, client: AxiosInstance = apiClient): Promise<MatchResult> {
  const response = await send(client, "PUT", `/me/finance/pantry/receipts/${encodeURIComponent(receiptId)}/lines/${n}`, 200, choice);
  if (conflict(response, "name_taken")) return { kind: "fields", fields: { name: "taken" } };
  if (response?.status === 404) return { kind: "not-found" };
  const receipt = response?.status === 200 ? parseReceipt(response.data) : null;
  return receipt ? { kind: "ok", receipt } : { kind: "error" };
}

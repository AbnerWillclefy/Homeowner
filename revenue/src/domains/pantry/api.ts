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
  /** The newest purchase's unit price; absent for an item never bought. */
  lastPriceCents?: number;
  /** Days from a purchase to its run-out, averaged; absent until one cycle is complete. */
  avgDurationDays?: number;
}

/** One purchase of an item, as `GET pantry/items/{id}` lists it (newest first). */
export interface ItemPrice {
  /** `YYYY-MM-DD`. */
  issuedOn: string;
  unitPriceCents: number;
  storeName: string;
}

export interface ItemDetail {
  item: PantryItem;
  avgDurationDays: number | null;
  prices: ItemPrice[];
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
const isInt = (v: unknown): v is number => Number.isSafeInteger(v);

const itemUrl = (id: string) => `/me/finance/pantry/items/${encodeURIComponent(id)}`;

function parseItem(v: unknown): PantryItem | null {
  if (!isRecord(v)) return null;
  const { id, name, preferredBrand, fixed, state, ranOutOn } = v;
  if (typeof id !== "string" || typeof name !== "string" || typeof fixed !== "boolean") return null;
  if (state !== "in_stock" && state !== "ran_out") return null;
  if (preferredBrand !== undefined && preferredBrand !== null && typeof preferredBrand !== "string") return null;
  if (ranOutOn !== undefined && ranOutOn !== null && typeof ranOutOn !== "string") return null;
  const { lastPriceCents, avgDurationDays } = v;
  if (lastPriceCents !== undefined && !isInt(lastPriceCents)) return null;
  if (avgDurationDays !== undefined && !isInt(avgDurationDays)) return null;
  return {
    id, name, preferredBrand: preferredBrand ?? null, fixed, state, ranOutOn: ranOutOn ?? null,
    ...(lastPriceCents === undefined ? {} : { lastPriceCents }),
    ...(avgDurationDays === undefined ? {} : { avgDurationDays }),
  };
}

function parsePrice(v: unknown): ItemPrice | null {
  if (!isRecord(v)) return null;
  const { issuedOn, unitPriceCents, storeName } = v;
  return typeof issuedOn === "string" && isInt(unitPriceCents) && typeof storeName === "string" ? { issuedOn, unitPriceCents, storeName } : null;
}

/** An item read: its detail, or a 404 (deleted on another device). Anything else throws, so a query shows its error state. */
export type ItemRead = { kind: "ok"; detail: ItemDetail } | { kind: "not-found" };

/** `GET /me/finance/pantry/items/{id}`. */
export async function getItem(id: string, client: AxiosInstance = apiClient): Promise<ItemRead> {
  const url = itemUrl(id);
  const { status, data } = await client.get(url);
  if (status === 404) return { kind: "not-found" };
  if (status !== 200) throw new Error(`GET ${url} answered ${status}`);
  const item = isRecord(data) ? parseItem(data.item) : null;
  const avg = isRecord(data) ? data.avgDurationDays : undefined;
  const prices = isRecord(data) && Array.isArray(data.prices) ? data.prices.map(parsePrice) : null;
  if (!item || !prices || prices.some((p) => p === null) || (avg !== undefined && avg !== null && !isInt(avg))) throw new Error(`GET ${url} answered a malformed body`);
  return { kind: "ok", detail: { item, avgDurationDays: avg ?? null, prices: prices as ItemPrice[] } };
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

/** One line of a draft read from a photo, before the User has checked it. */
export interface ReceiptDraftLine {
  description: string;
  quantityMilli: number;
  unit: string;
  unitPriceCents: number;
  totalCents: number;
}

/** What the model read from a photo (`POST pantry/receipts/photo`). Untrusted until the User confirms it and `saveDraft` stores it. */
export interface ReceiptDraft {
  storeName: string;
  /** Digits only, or empty. Sent back unchanged. */
  storeCnpj: string;
  /** A valid NFC-e access key, or empty. Sent back unchanged. */
  accessKey: string;
  /** `YYYY-MM-DD`; the model may get it wrong, so it can be anything until validated. */
  issuedOn: string;
  totalCents: number;
  lines: ReceiptDraftLine[];
}

/** A photo read: a draft (nothing saved), the daily cap (429), a photo the model could not read (502), or a failure. */
export type ReadPhotoResult = { kind: "draft"; draft: ReceiptDraft } | { kind: "cap" } | { kind: "unreadable" } | { kind: "error" };

/** Saving a draft: like `AddReceiptResult`, or refused (400 `invalid_draft`) with the field codes, such as `lines.2.totalCents`. */
export type SaveDraftResult = { kind: "created" | "duplicate"; receipt: Receipt } | { kind: "rejected"; fields: string[] } | { kind: "error" };

function parseDraftLine(v: unknown): ReceiptDraftLine | null {
  if (!isRecord(v)) return null;
  const { description, quantityMilli, unit, unitPriceCents, totalCents } = v;
  if (typeof description !== "string" || !isInt(quantityMilli) || typeof unit !== "string" || !isInt(unitPriceCents) || !isInt(totalCents)) return null;
  return { description, quantityMilli, unit, unitPriceCents, totalCents };
}

function parseDraft(v: unknown): ReceiptDraft | null {
  if (!isRecord(v)) return null;
  const { storeName, storeCnpj, accessKey, issuedOn, totalCents, lines } = v;
  if (typeof storeName !== "string" || typeof issuedOn !== "string" || !isInt(totalCents) || !Array.isArray(lines)) return null;
  // The two optional ones may be missing; anything else than text is refused.
  if ((storeCnpj !== undefined && typeof storeCnpj !== "string") || (accessKey !== undefined && typeof accessKey !== "string")) return null;
  const parsed = lines.map(parseDraftLine);
  return parsed.every((l) => l !== null) ? { storeName, storeCnpj: storeCnpj ?? "", accessKey: accessKey ?? "", issuedOn, totalCents, lines: parsed } : null;
}

/** `POST /me/finance/pantry/receipts/photo`: the downsized JPEG as the raw body. The model can take up to 20 s; the client sets no shorter timeout. */
export async function readPhoto(photo: Blob, client: AxiosInstance = apiClient): Promise<ReadPhotoResult> {
  let response;
  try {
    response = await client.request({ method: "POST", url: "/me/finance/pantry/receipts/photo", data: photo, headers: { "Content-Type": "image/jpeg" } });
  } catch {
    return { kind: "error" };
  }
  const { status, data } = response;
  if (status === 429 && errorCode(data) === "photo_cap") return { kind: "cap" };
  if (status === 502 && errorCode(data) === "photo_unreadable") return { kind: "unreadable" };
  const draft = status === 200 && isRecord(data) ? parseDraft(data.draft) : null;
  return draft ? { kind: "draft", draft } : { kind: "error" };
}

/** `POST /me/finance/pantry/receipts` with `{ draft }`: the draft the User confirmed. A 200 is a receipt saved before. */
export async function saveDraft(draft: ReceiptDraft, client: AxiosInstance = apiClient): Promise<SaveDraftResult> {
  let response;
  try {
    response = await client.request({ method: "POST", url: "/me/finance/pantry/receipts", data: { draft } });
  } catch {
    return { kind: "error" };
  }
  const { status, data } = response;
  if (status === 400 && errorCode(data) === "invalid_draft" && isRecord(data) && Array.isArray(data.fields)) {
    return { kind: "rejected", fields: data.fields.filter((f): f is string => typeof f === "string") };
  }
  const receipt = status === 200 || status === 201 ? parseReceipt(data) : null;
  return receipt ? { kind: status === 201 ? "created" : "duplicate", receipt } : { kind: "error" };
}

/** One line of the next shopping list, as `GET pantry/list` serves it. */
export interface ShoppingListItem {
  itemId: string;
  name: string;
  preferredBrand: string | null;
  fixed: boolean;
  /** Thousandths of `unit`: 1500 is 1,5 kg. */
  quantityMilli: number;
  /** `UN` or `KG`. */
  unit: string;
  /** Absent for an item never bought; so is `priceCents`, the whole line. */
  unitPriceCents?: number;
  priceCents?: number;
}

export interface ShoppingList {
  items: ShoppingListItem[];
  /** The priced lines added up; unpriced ones are left out. */
  expectedTotalCents: number;
  /** What is left of this month's groceries limit; negative once over it, absent with no limit. */
  groceriesLeftCents?: number;
}

function parseListItem(v: unknown): ShoppingListItem | null {
  if (!isRecord(v)) return null;
  const { itemId, name, preferredBrand, fixed, quantityMilli, unit, unitPriceCents, priceCents } = v;
  if (typeof itemId !== "string" || typeof name !== "string" || typeof fixed !== "boolean" || !isInt(quantityMilli) || quantityMilli < 1 || typeof unit !== "string") return null;
  if (preferredBrand !== undefined && preferredBrand !== null && typeof preferredBrand !== "string") return null;
  if ((unitPriceCents !== undefined && !isInt(unitPriceCents)) || (priceCents !== undefined && !isInt(priceCents))) return null;
  return {
    itemId, name, preferredBrand: preferredBrand ?? null, fixed, quantityMilli, unit,
    ...(unitPriceCents === undefined ? {} : { unitPriceCents }),
    ...(priceCents === undefined ? {} : { priceCents }),
  };
}

/** `GET /me/finance/pantry/list`. Throws on any failure, so a query shows its error state. */
export async function getList(client: AxiosInstance = apiClient): Promise<ShoppingList> {
  const url = "/me/finance/pantry/list";
  const { status, data } = await client.get(url);
  if (status !== 200) throw new Error(`GET ${url} answered ${status}`);
  const items = isRecord(data) && Array.isArray(data.items) ? data.items.map(parseListItem) : null;
  const total = isRecord(data) ? data.expectedTotalCents : undefined;
  const left = isRecord(data) ? data.groceriesLeftCents : undefined;
  if (!items || items.some((i) => i === null) || !isInt(total) || (left !== undefined && !isInt(left))) throw new Error(`GET ${url} answered a malformed body`);
  return { items: items as ShoppingListItem[], expectedTotalCents: total, ...(left === undefined ? {} : { groceriesLeftCents: left }) };
}

/** `PUT /me/finance/pantry/list/{itemId}`: a new quantity, or `removed` (it comes back only once bought again). */
export const editListItem = async (itemId: string, edit: { quantityMilli: number } | { removed: true }, client: AxiosInstance = apiClient): Promise<WriteResult> =>
  writeResult(await send(client, "PUT", `/me/finance/pantry/list/${encodeURIComponent(itemId)}`, 204, edit), 204);

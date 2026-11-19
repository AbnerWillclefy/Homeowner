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

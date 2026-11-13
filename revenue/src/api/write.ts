import type { AxiosInstance, AxiosResponse } from "axios";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Field name to the API's stable machine code, for example `{ dueDay: "invalid" }`. */
export type FieldCodes = Record<string, string>;

/** 404 is another User's or a missing row. */
export type WriteResult = { kind: "ok" } | { kind: "not-found" } | { kind: "error" };
export type SaveResult = WriteResult | { kind: "fields"; fields: FieldCodes };

/** A 400 body's `{ fields: { name: code } }`, or null when it has none. */
export function fieldsOf(response: AxiosResponse): FieldCodes | null {
  const body: unknown = response.data;
  if (!isRecord(body) || !isRecord(body.fields)) return null;
  const entries = Object.entries(body.fields).filter((e): e is [string, string] => typeof e[1] === "string");
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export async function send(client: AxiosInstance, method: string, url: string, ok: number, data?: unknown): Promise<AxiosResponse | null> {
  try {
    const response = await client.request({ method, url, data });
    return response.status === ok || response.status === 404 || response.status === 400 ? response : null;
  } catch {
    return null;
  }
}

export const writeResult = (response: AxiosResponse | null, ok: number): WriteResult =>
  response?.status === ok ? { kind: "ok" } : response?.status === 404 ? { kind: "not-found" } : { kind: "error" };


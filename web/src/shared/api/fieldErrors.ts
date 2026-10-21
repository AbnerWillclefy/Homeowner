import type { AxiosResponse } from "axios";

/** Field name to the API's stable machine code, for example `{ timezone: "unknown" }`. */
export type FieldCodes = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** The field codes of a 400 body (`{ fields: { name: code } }`), or null when there are none. */
export function parseFields(response: AxiosResponse): FieldCodes | null {
  const body: unknown = response.data;
  if (!isRecord(body) || !isRecord(body.fields)) return null;
  const entries = Object.entries(body.fields).filter((e): e is [string, string] => typeof e[1] === "string");
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

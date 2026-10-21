import type { Chore, ChoreInput, Failure } from "../../chores/api/api";
import type { FieldCodes } from "../../home/api/api";
import { authedRequest } from "../../auth/api/client";

/** One Catalog Chore. `id` is the Catalog id (for example `clean_bathroom`), not a stored Chore's id. */
export interface CatalogEntry extends Chore {
  /** Whether the entry repeats once per room. */
  perRoom: boolean;
}

/** A Chore the questionnaire calls for. `instance` is 1-based when the answers produce several, else null. */
export interface Proposal extends ChoreInput {
  catalogId: string;
  instance: number | null;
}

/** The questionnaire as sent. Every part is optional; a missing one means none. */
export interface AnswersBody {
  rooms?: { bedrooms: number; bathrooms: number; kitchens: number; livingRooms: number; laundryAreas: number };
  outdoor?: string;
  pets?: string[];
  collection?: { trash: number[]; recycling: number[] };
  habits?: { cooking: string; dishwasher: boolean; washingMachine: boolean };
}

export type GetCatalogResult = { kind: "ok"; entries: CatalogEntry[] } | Failure;

export type ProposeResult = { kind: "ok"; proposals: Proposal[] } | { kind: "invalid"; fields: FieldCodes } | Failure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNumberList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

/** The Chore fields every Catalog entry and proposal carries, or null if any is missing or the wrong type. */
function parseFields(body: Record<string, unknown>): ChoreInput | null {
  const { name, category, demands, baseEffort, importance, people, intervalDays, allowedWeekdays, buildsUp } = body;
  if (
    typeof name !== "string" ||
    typeof category !== "string" ||
    !isStringList(demands) ||
    typeof baseEffort !== "number" ||
    typeof importance !== "string" ||
    typeof people !== "number" ||
    !(intervalDays === null || typeof intervalDays === "number") ||
    !isNumberList(allowedWeekdays) ||
    typeof buildsUp !== "boolean"
  ) {
    return null;
  }
  return { name, category, demands, baseEffort, importance, people, intervalDays, allowedWeekdays, buildsUp };
}

function parseEntry(body: unknown): CatalogEntry | null {
  if (!isRecord(body) || typeof body.id !== "string" || typeof body.perRoom !== "boolean") return null;
  const fields = parseFields(body);
  return fields ? { id: body.id, perRoom: body.perRoom, ...fields } : null;
}

function parseProposal(body: unknown): Proposal | null {
  if (!isRecord(body) || typeof body.catalogId !== "string") return null;
  const { instance } = body;
  if (!(instance === null || typeof instance === "number")) return null;
  const fields = parseFields(body);
  return fields ? { catalogId: body.catalogId, instance, ...fields } : null;
}

function parseList<T>(body: unknown, key: string, parse: (item: unknown) => T | null): T[] | null {
  if (!isRecord(body)) return null;
  const list = body[key];
  if (!Array.isArray(list)) return null;
  const items: T[] = [];
  for (const raw of list) {
    const item = parse(raw);
    if (item === null) return null;
    items.push(item);
  }
  return items;
}

export async function getCatalog(): Promise<GetCatalogResult> {
  try {
    const result = await authedRequest({ url: "/catalog" });
    if (result.kind === "not-signed-in") return result;
    if (result.response.status !== 200) return { kind: "error" };
    const entries = parseList(result.response.data, "entries", parseEntry);
    return entries ? { kind: "ok", entries } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

/** Turns the answers into proposed Chores. Writes nothing, so it can be called as often as needed. */
export async function proposeChores(answers: AnswersBody): Promise<ProposeResult> {
  try {
    const result = await authedRequest({
      url: "/catalog/proposals",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify(answers),
    });
    if (result.kind === "not-signed-in") return result;
    const { response } = result;
    if (response.status === 400) {
      const body: unknown = response.data;
      if (!isRecord(body) || !isRecord(body.fields)) return { kind: "error" };
      const entries = Object.entries(body.fields).filter((e): e is [string, string] => typeof e[1] === "string");
      return entries.length > 0 ? { kind: "invalid", fields: Object.fromEntries(entries) } : { kind: "error" };
    }
    if (response.status !== 200) return { kind: "error" };
    const proposals = parseList(response.data, "proposals", parseProposal);
    return proposals ? { kind: "ok", proposals } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

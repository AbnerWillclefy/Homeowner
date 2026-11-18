import type { Chore, ChoreWire } from "../api/api";

/** Everything the Chore form holds, as typed. The interval stays text so a blank can mean one-off. */
export interface ChoreFormState {
  name: string;
  category: string;
  demands: string[];
  baseEffort: number;
  importance: string;
  people: number;
  /** Blank means the Chore comes due once. */
  intervalDays: string;
  /** 0 to 6 with 0 = Sunday, as on the wire. */
  allowedWeekdays: number[];
  buildsUp: boolean;
  /** A Resident id, or "" for Nobody. Not part of the Chore's request body: it is saved by its own call. */
  responsible: string;
}

/** The form for a new Chore: nothing chosen that the Resident has not decided. */
export function emptyForm(): ChoreFormState {
  return {
    name: "",
    category: "",
    demands: [],
    baseEffort: 2,
    importance: "normal",
    people: 1,
    intervalDays: "",
    allowedWeekdays: [],
    buildsUp: false,
    responsible: "",
  };
}

/** A Catalog entry has no one responsible, so `responsibleResidentId` may be absent. */
export function formFromChore(chore: Omit<Chore, "responsibleResidentId"> & { responsibleResidentId?: string | null }): ChoreFormState {
  return {
    name: chore.name,
    category: chore.category,
    demands: [...chore.demands],
    baseEffort: chore.baseEffort,
    importance: chore.importance,
    people: chore.people,
    intervalDays: chore.intervalDays === null ? "" : String(chore.intervalDays),
    allowedWeekdays: [...chore.allowedWeekdays],
    buildsUp: chore.buildsUp,
    responsible: chore.responsibleResidentId ?? "",
  };
}

function intervalFromText(text: string): number | string | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  // Anything that is not a number goes as typed, so the API's field error is about what the person wrote.
  return Number.isFinite(n) ? n : trimmed;
}

/**
 * The request body for a form. The checks that matter (name, ranges, ids) are the API's; this only
 * shapes the values, so the field errors that come back are about exactly what was typed.
 */
export function toChoreInput(form: ChoreFormState): ChoreWire {
  return {
    name: form.name,
    category: form.category,
    demands: [...form.demands],
    baseEffort: form.baseEffort,
    importance: form.importance,
    people: form.people,
    intervalDays: intervalFromText(form.intervalDays),
    allowedWeekdays: [...new Set(form.allowedWeekdays)].sort((a, b) => a - b),
    buildsUp: form.buildsUp,
  };
}

/** The list with the value added when absent and removed when present. */
export function toggled<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

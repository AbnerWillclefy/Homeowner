import type { CheckIn, Level } from "../api/checkIn";

/** What the Check-in form holds. `level` is null until the person picks one: no default is assumed. */
export interface CheckInFormState {
  level: Level | null;
  restrictions: string[];
}

export type Submission =
  | { ok: true; level: Level; restrictions: string[] }
  | { ok: false; error: "level-required" };

export const emptyForm = (): CheckInFormState => ({ level: null, restrictions: [] });

/** A missing Check-in starts empty; changing one starts from what was saved. */
export const formFrom = (checkIn: CheckIn): CheckInFormState =>
  checkIn.checkedIn ? { level: checkIn.level, restrictions: [...checkIn.restrictions] } : emptyForm();

export function toggledRestriction(restrictions: readonly string[], id: string): string[] {
  return restrictions.includes(id) ? restrictions.filter((r) => r !== id) : [...restrictions, id];
}

/** The request to send, with Restrictions in the order of `demands` and only ids the app still lists. */
export function submission(form: CheckInFormState, demands: readonly string[]): Submission {
  if (form.level === null) return { ok: false, error: "level-required" };
  return { ok: true, level: form.level, restrictions: demands.filter((d) => form.restrictions.includes(d)) };
}

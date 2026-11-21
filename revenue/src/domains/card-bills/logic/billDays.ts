export type BillDaysRead =
  | { ok: true; closeDay: number | null; dueDay: number | null }
  | { ok: false; errors: { closeDay?: string; dueDay?: string } };

/** A day of the month typed as digits, or null when empty, not whole digits or outside 1 to 31. */
export function readDay(text: string): number | null {
  const day = /^\d{1,2}$/.test(text.trim()) ? Number(text.trim()) : 0;
  return day >= 1 && day <= 31 ? day : null;
}

/** Both empty clears the card's days, both valid saves them; one alone is `required` on the empty one. The codes are the API's. */
export function readBillDays(closeText: string, dueText: string): BillDaysRead {
  const closeEmpty = closeText.trim() === "";
  const dueEmpty = dueText.trim() === "";
  if (closeEmpty && dueEmpty) return { ok: true, closeDay: null, dueDay: null };
  const closeDay = readDay(closeText);
  const dueDay = readDay(dueText);
  if (closeDay !== null && dueDay !== null) return { ok: true, closeDay, dueDay };
  const errors: { closeDay?: string; dueDay?: string } = {};
  if (closeDay === null) errors.closeDay = closeEmpty ? "required" : "invalid";
  if (dueDay === null) errors.dueDay = dueEmpty ? "required" : "invalid";
  return { ok: false, errors };
}

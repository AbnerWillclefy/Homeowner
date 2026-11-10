import type { BillInput } from "../api/api";
import { parseMoney } from "./parseMoney";

export interface BillFields {
  name: string;
  amount: string;
  dueDay: string;
}

export type BillFormResult = { ok: true; input: BillInput } | { ok: false; errors: Record<string, string> };

/** A day of the month typed as digits, or null when empty, not whole digits or outside 1 to 31. */
export function readDay(text: string): number | null {
  const day = /^\d{1,2}$/.test(text.trim()) ? Number(text.trim()) : 0;
  return day >= 1 && day <= 31 ? day : null;
}

const MAX_NAME = 60; // backend maxBillName

/** Checks what was typed before it is sent; the codes are the API's, so one table of messages serves both. */
export function billInputOf(fields: BillFields, locale: string): BillFormResult {
  const errors: Record<string, string> = {};
  const name = fields.name.trim();
  if (name === "") errors.name = "required";
  else if ([...name].length > MAX_NAME) errors.name = "too_long";
  const expectedCents = parseMoney(fields.amount, locale);
  if (expectedCents === null) errors.expectedCents = "invalid";
  const dueDay = readDay(fields.dueDay);
  if (dueDay === null) errors.dueDay = "invalid";
  if (expectedCents === null || dueDay === null || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input: { name, expectedCents, dueDay } };
}

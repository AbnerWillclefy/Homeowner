import type { BillInput } from "../api/api";
import { parseMoney } from "./parseMoney";

export interface BillFields {
  name: string;
  amount: string;
  dueDay: string;
}

export type BillFormResult = { ok: true; input: BillInput } | { ok: false; errors: Record<string, string> };

const MAX_NAME = 60; // backend maxBillName

/** Checks what was typed before it is sent; the codes are the API's, so one table of messages serves both. */
export function billInputOf(fields: BillFields, locale: string): BillFormResult {
  const errors: Record<string, string> = {};
  const name = fields.name.trim();
  if (name === "") errors.name = "required";
  else if ([...name].length > MAX_NAME) errors.name = "too_long";
  const expectedCents = parseMoney(fields.amount, locale);
  if (expectedCents === null) errors.expectedCents = "invalid";
  const dueDay = /^\d{1,2}$/.test(fields.dueDay.trim()) ? Number(fields.dueDay) : 0;
  if (dueDay < 1 || dueDay > 31) errors.dueDay = "invalid";
  if (expectedCents === null || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input: { name, expectedCents, dueDay } };
}

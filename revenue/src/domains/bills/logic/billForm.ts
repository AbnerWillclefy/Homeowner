import type { MessageKey } from "../../../shared/i18n/catalogs";
import type { BillInput } from "../api";

export interface BillFields {
  name: string;
  /** From the money field: null when empty or not an amount. */
  cents: number | null;
  dueDay: string;
}

export type BillFormResult = { ok: true; input: BillInput } | { ok: false; errors: Record<string, string> };

const MAX_NAME = 60; // backend maxBillName
const MAX_CENTS = 1_000_000_000_000; // backend maxBillCents

/** A day of the month typed as digits, or null when empty, not whole digits or outside 1 to 31. */
export function readDay(text: string): number | null {
  const day = /^\d{1,2}$/.test(text.trim()) ? Number(text.trim()) : 0;
  return day >= 1 && day <= 31 ? day : null;
}

/** Checks what was typed before it is sent; the codes are the API's, so one table of messages serves both. */
export function billInputOf(fields: BillFields): BillFormResult {
  const errors: Record<string, string> = {};
  const name = fields.name.trim();
  if (name === "") errors.name = "required";
  else if ([...name].length > MAX_NAME) errors.name = "too_long";
  const { cents } = fields;
  if (cents === null || cents <= 0 || cents > MAX_CENTS) errors.expectedCents = "invalid";
  const dueDay = readDay(fields.dueDay);
  if (dueDay === null) errors.dueDay = "invalid";
  if (cents === null || dueDay === null || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input: { name, expectedCents: cents, dueDay } };
}

/** Every field code a Bill can come back with (backend/internal/finance/bills.go billBody), keyed "field.code". */
const FIELD_ERROR_KEY: Record<string, MessageKey> = {
  "name.required": "bills.field.name.required",
  "name.too_long": "bills.field.name.too_long",
  "name.invalid": "bills.field.name.invalid",
  "expectedCents.invalid": "bills.field.expectedCents.invalid",
  "dueDay.invalid": "bills.field.dueDay.invalid",
};

/** The message for a field's error code. A code this app does not know still gets a message. */
export const billFieldErrorKey = (field: string, code: string): MessageKey => FIELD_ERROR_KEY[`${field}.${code}`] ?? "bills.field.unknown";

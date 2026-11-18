import type { MessageKey } from "../../../shared/i18n/catalogs";
import { addMonths } from "../../../shared/month/month";
import type { ManualCardInput } from "../api";
import { readDay } from "../../bills/logic/billForm";

const MAX_NAME = 60; // backend maxNameRunes
const MAX_CENTS = 1_000_000_000_000; // backend maxBillCents

/** The 12 months a manual card can be typed for: `thisMonth` and the 11 after it. */
export const manualMonths = (thisMonth: string): string[] => Array.from({ length: 12 }, (_, i) => addMonths(thisMonth, i));

export interface ManualCardFields {
  name: string;
  dueDay: string;
  pixRecipient: string;
  /** Cents per month as typed; null or absent is empty. */
  bills: Record<string, number | null>;
}

export type ManualCardFormResult = { ok: true; input: ManualCardInput } | { ok: false; errors: Record<string, string> };

/** Checks what was typed before it is sent. The codes are the API's, so one table of messages serves both. An empty month goes as null, which clears it. */
export function manualCardInputOf(fields: ManualCardFields, months: string[]): ManualCardFormResult {
  const errors: Record<string, string> = {};
  const name = fields.name.trim();
  if (name === "") errors.name = "required";
  else if ([...name].length > MAX_NAME) errors.name = "too_long";
  const dueDay = readDay(fields.dueDay);
  if (dueDay === null) errors.dueDay = "invalid";
  const pixRecipient = fields.pixRecipient.trim();
  if ([...pixRecipient].length > MAX_NAME) errors.pixRecipient = "too_long";
  const bills = Object.fromEntries(months.map((m) => [m, fields.bills[m] ?? null]));
  if (Object.values(bills).some((c) => c !== null && (c < 0 || c > MAX_CENTS))) errors.bills = "invalid";
  if (dueDay === null || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input: { name, dueDay, pixRecipient: pixRecipient === "" ? null : pixRecipient, bills } };
}

const FIELD_ERROR_KEY: Record<string, MessageKey> = {
  "name.required": "bills.field.name.required",
  "name.too_long": "bills.field.name.too_long",
  "name.invalid": "bills.field.name.invalid",
  "dueDay.invalid": "bills.field.dueDay.invalid",
  "pixRecipient.required": "manualCard.field.pixRecipient.invalid",
  "pixRecipient.too_long": "bills.field.name.too_long",
  "pixRecipient.invalid": "manualCard.field.pixRecipient.invalid",
  "bills.invalid": "manualCard.field.bills.invalid",
  "bills.invalid_month": "manualCard.field.bills.invalidMonth",
};

/** The message for a field's error code. A code this app does not know still gets a message. */
export const manualCardFieldErrorKey = (field: string, code: string): MessageKey => FIELD_ERROR_KEY[`${field}.${code}`] ?? "bills.field.unknown";

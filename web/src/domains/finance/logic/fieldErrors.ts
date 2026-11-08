import type { MessageKey } from "../../../shared/i18n";

/** Every field code a Bill can come back with (backend/internal/finance/bills.go billBody), keyed "field.code". */
const FIELD_ERROR_KEY: Record<string, MessageKey> = {
  "name.required": "finances.bills.field.name.required",
  "name.too_long": "finances.bills.field.name.too_long",
  "name.invalid": "finances.bills.field.name.invalid",
  "expectedCents.invalid": "finances.bills.field.expectedCents.invalid",
  "dueDay.invalid": "finances.bills.field.dueDay.invalid",
};

/** The message for a field's error code. A code this app does not know still gets a message. */
export function billFieldErrorKey(field: string, code: string): MessageKey {
  return FIELD_ERROR_KEY[`${field}.${code}`] ?? "finances.bills.field.unknown";
}

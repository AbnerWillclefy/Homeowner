import type { MessageKey } from "../../../shared/i18n/catalogs";

/** Every field code an item can come back with, keyed "field.code": ours from the form, the API's `name_taken` as "taken". */
const KEYS: Record<string, MessageKey> = {
  "name.required": "pantry.field.name.required",
  "name.too_long": "pantry.field.name.too_long",
  "name.taken": "pantry.field.name.taken",
  "name.invalid": "pantry.field.name.invalid",
  "preferredBrand.too_long": "pantry.field.preferredBrand.too_long",
};

/** The message for a field's error code. A code this app does not know still gets a message. */
export const pantryFieldErrorKey = (field: string, code: string): MessageKey => KEYS[`${field}.${code}`] ?? "pantry.field.unknown";

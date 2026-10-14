import type { MessageKey } from "../../../shared/i18n";

/** Every field code the API can return (backend/internal/chores/chores.go Validate), keyed "field.code". */
const FIELD_ERROR_KEY: Record<string, MessageKey> = {
  "name.required": "chores.field.name.required",
  "name.too_long": "chores.field.name.too_long",
  "category.required": "chores.field.category.required",
  "category.unknown": "chores.field.category.unknown",
  "importance.required": "chores.field.importance.required",
  "importance.unknown": "chores.field.importance.unknown",
  "demands.unknown": "chores.field.demands.unknown",
  "baseEffort.required": "chores.field.baseEffort.required",
  "baseEffort.invalid": "chores.field.baseEffort.invalid",
  "baseEffort.out_of_range": "chores.field.baseEffort.out_of_range",
  "people.required": "chores.field.people.required",
  "people.invalid": "chores.field.people.invalid",
  "people.out_of_range": "chores.field.people.out_of_range",
  "intervalDays.required": "chores.field.intervalDays.required",
  "intervalDays.invalid": "chores.field.intervalDays.invalid",
  "intervalDays.out_of_range": "chores.field.intervalDays.out_of_range",
  "allowedWeekdays.invalid": "chores.field.allowedWeekdays.invalid",
  "allowedWeekdays.out_of_range": "chores.field.allowedWeekdays.out_of_range",
};

/** The message for a field's error code. A code this app does not know still gets a message. */
export function choreFieldErrorKey(field: string, code: string): MessageKey {
  return FIELD_ERROR_KEY[`${field}.${code}`] ?? "chores.field.unknown";
}

import type { MessageKey } from "../shared/i18n";

/** Every field code the API can return (backend/internal/server/home.go), keyed "field.code". */
const FIELD_ERROR_KEY: Record<string, MessageKey> = {
  "timezone.required": "home.field.timezone.required",
  "timezone.unknown": "home.field.timezone.unknown",
  "allocationTime.required": "home.field.allocationTime.required",
  "allocationTime.invalid": "home.field.allocationTime.invalid",
  "allocationTime.not_quarter_hour": "home.field.allocationTime.not_quarter_hour",
};

/** The message for a field's error code. A code this app does not know still gets a message. */
export function fieldErrorKey(field: string, code: string): MessageKey {
  return FIELD_ERROR_KEY[`${field}.${code}`] ?? "home.field.unknown";
}

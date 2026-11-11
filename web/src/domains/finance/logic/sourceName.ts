import type { MessageKey } from "../../../shared/i18n";

export type SourceNameRead = { ok: true; name: string } | { ok: false; code: "required" };

/** The name to send: trimmed, and an empty one is refused here with the API's own code. */
export function readSourceName(text: string): SourceNameRead {
  const name = text.trim();
  return name === "" ? { ok: false, code: "required" } : { ok: true, name };
}

const KEY: Record<string, MessageKey> = {
  required: "finances.sourceName.required",
  too_long: "finances.sourceName.too_long",
  invalid: "finances.sourceName.invalid",
};

/** The message for a `fields.name` code; a code this app does not know gets the generic failure. */
export function sourceNameErrorKey(code: string): MessageKey {
  return KEY[code] ?? "finances.billDays.failed";
}

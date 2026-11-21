import type { MessageKey } from "../../../shared/i18n/catalogs";

export type SourceNameRead = { ok: true; name: string } | { ok: false; code: "required" };

/** The name to send: trimmed, and an empty one is refused here with the API's own code. */
export function readSourceName(text: string): SourceNameRead {
  const name = text.trim();
  return name === "" ? { ok: false, code: "required" } : { ok: true, name };
}

const KEY: Record<string, MessageKey> = {
  required: "sources.name.required",
  too_long: "sources.name.too_long",
  invalid: "sources.name.invalid",
};

/** The message for a `fields.name` code; a code this app does not know gets the generic failure. */
export const sourceNameErrorKey = (code: string): MessageKey => KEY[code] ?? "sources.name.failed";

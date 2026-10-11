// en-US is the source of truth for message keys.
//
// - Keys are stable identifiers, grouped by screen (home.*, health.*).
// - One whole sentence per key, so translators can reorder words freely.
// - Placeholders are written {name}; a plural is { one, other, many? } and
//   needs a {count} placeholder.
// - No markup and no literal braces inside a message.
// - The agreed pt-BR wording for domain terms is in docs/glossary-pt-BR.md.
import type { Message } from "../translate";

export const enUS = {
  "app.name": "Homeowner",
  "home.tagline": "Share the housework in your Home fairly.",
  "health.loading": "Checking the service...",
  "health.ok": "Service status: ok",
  "health.unavailable": "Service status: unavailable. The service is up but cannot reach its database.",
  "health.unreachable": "Service status: unreachable. Check your connection and try again.",
  "health.retry": "Try again",
  "auth.checking": "Checking your sign-in...",
} as const satisfies Record<string, Message>;

export type MessageKey = keyof typeof enUS;

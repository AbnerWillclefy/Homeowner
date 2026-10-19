/** The longest display name, in code points. Mirrors `MaxNameLength` in backend/internal/users/name.go. */
export const NAME_MAX = 40;

export type NameCheck =
  /** `name` is the trimmed name to send. */
  | { kind: "ok"; name: string; count: number }
  /** Blank after trimming: sending it clears the name, and the email's local part shows instead. */
  | { kind: "clear"; count: 0 }
  | { kind: "too_long"; count: number };

/**
 * The same trim and count the server applies, so the screen can stop a name before the request. The count is in
 * code points (`Array.from`), like Go's `utf8.RuneCountInString`, not `.length`, which counts UTF-16 units and
 * would count an emoji twice. A letter with a combining accent counts as two, as on the server.
 *
 * `trim()` and Go's `strings.TrimSpace` agree on the ordinary and Unicode spaces (no-break, ideographic). They
 * differ at the edges: JS also trims U+FEFF, Go also trims U+0085. The server stays the judge: it also refuses
 * control and bidi override characters, which the screen shows from the API's `invalid` answer.
 */
export function checkName(raw: string): NameCheck {
  const name = raw.trim();
  const count = Array.from(name).length;
  if (count === 0) return { kind: "clear", count: 0 };
  if (count > NAME_MAX) return { kind: "too_long", count };
  return { kind: "ok", name, count };
}

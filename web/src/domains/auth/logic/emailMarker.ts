/**
 * Catalog messages hold no markup, but a few sentences set the email in bold. The screen asks the
 * catalog for the whole sentence with this marker in place of `{email}`, splits there, and puts
 * the real email (as text, never as markup) in a <strong> between the two halves. A private-use
 * character, so it cannot be mistaken for anything a person types. Written as an escape so an
 * editor cannot silently drop it.
 */
export const EMAIL_MARKER = "";

/** The text before and after the marker. All of it comes back as `before` if there is no marker. */
export function splitAtEmail(text: string): [before: string, after: string] {
  const at = text.indexOf(EMAIL_MARKER);
  if (at === -1) return [text, ""];
  return [text.slice(0, at), text.slice(at + EMAIL_MARKER.length)];
}

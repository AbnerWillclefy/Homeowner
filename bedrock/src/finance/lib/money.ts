/**
 * Parses text typed or pasted by a Resident into integer cents, or null when there is no valid amount.
 * Integer arithmetic only. Zero is a valid amount (0); a consumer that cannot accept zero passes `error`.
 * Negative amounts are rejected (null): the field only accepts amounts.
 */
export function parseCents(text: string): number | null {
  // Spaces (incl. U+00A0, U+202F), currency symbols and letters are noise from pasting.
  const s = text.replace(/[\s\p{L}\p{Sc}]/gu, "");
  if (!/^[\d.,]+$/.test(s)) return null; // empty, minus signs and anything else

  const count = (c: string) => s.split(c).length - 1;

  let decimal: "." | "," | null = null;
  if (count(".") && count(",")) {
    decimal = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
  } else {
    const sep = count(".") ? "." : count(",") ? "," : null;
    // A lone separator followed by 1 or 2 digits is decimal; otherwise it is grouping.
    if (sep && count(sep) === 1 && /^\d{1,2}$/.test(s.slice(s.indexOf(sep) + 1))) decimal = sep;
  }

  let whole = s;
  let fraction = "";
  if (decimal) {
    const i = s.lastIndexOf(decimal);
    whole = s.slice(0, i);
    fraction = s.slice(i + 1);
    if (fraction.length > 2) return null;
  }

  const groups = whole.split(/[.,]/);
  if (groups.length > 1) {
    const mixed = new Set(whole.replace(/\d/g, "")).size > 1; // e.g. 1,2.3,4
    if (mixed || !groups[0] || groups[0].length > 3 || groups.slice(1).some((g) => g.length !== 3)) return null;
  }

  const cents = Number(groups.join("")) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** BRL as the locale writes it: `R$ 1.234,56` in pt-BR. Cents are divided only here, at the last step. */
export function formatCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(cents / 100);
}

/**
 * Money typed by a person to integer cents, or null when it is not a non-negative amount. Accepts `R$`, spaces, and
 * either `1.234,56` or `1,234.56`: three digits after a separator are thousands, one or two are the decimals.
 * shortcut: no negative amounts and no scientific notation, add them when a screen needs them.
 */
export function parseMoney(text: string): number | null {
  const s = text.replace(/^\s*R\$/i, "").replace(/\s/g, "");
  const match = /^(\d+(?:[.,]\d{3})*)(?:[.,](\d{1,2}))?$/.exec(s);
  if (!match) return null;
  const cents = Number(match[1]!.replace(/[.,]/g, "") + (match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

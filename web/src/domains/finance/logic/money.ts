/** Cents as a field is filled in to edit: the locale's decimal mark, no symbol, no thousands marks (`parseMoney` reads it back). */
export function centsToInput(cents: number, locale: string): string {
  return (cents / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
}

/** BRL as the locale writes it: `R$ 1.234,56` in pt-BR. Cents are divided only here, at the last step. */
export function formatCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(cents / 100);
}

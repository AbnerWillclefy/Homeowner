/** BRL as the locale writes it: `R$ 1.234,56` in pt-BR. Cents are divided only here, at the last step. */
export function formatCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(cents / 100);
}

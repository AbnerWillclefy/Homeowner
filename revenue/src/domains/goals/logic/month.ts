/** `YYYY-MM` as "janeiro de 2029", with the month's first letter capitalised as the other screens write it. */
export function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" })
    .formatToParts(new Date(y, m - 1, 1))
    .map((p) => (p.type === "month" ? p.value.charAt(0).toLocaleUpperCase(locale) + p.value.slice(1) : p.value))
    .join("");
}

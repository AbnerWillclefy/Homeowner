const date = (month: string) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1);

/** "out" in pt-BR (Intl writes "out."), "Oct" in English. */
export function shortMonth(month: string, locale: string): string {
  const text = new Intl.DateTimeFormat(locale, { month: "short" }).format(date(month)).replace(/\.$/, "");
  return locale.startsWith("pt") ? text.toLocaleLowerCase(locale) : text;
}

/** "jun/27": a Goal's target month, short. */
export const shortMonthYear = (month: string, locale: string): string => `${shortMonth(month, locale)}/${month.slice(2, 4)}`;

/** A signed percent with at most one decimal: "+4%", "+2,5%", "-33%", "0%". */
export const percentText = (percent: number, locale: string): string =>
  new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(percent / 100);

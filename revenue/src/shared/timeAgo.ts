/** How long ago `iso` was, as "há 2 h" / "2h ago": minutes under an hour, hours under a day, then days. Under a minute, "agora" / "now". */
export function timeAgo(iso: string, now: Date, locale: string): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
  const rtf = new Intl.RelativeTimeFormat(locale, { style: "narrow", numeric: "auto" });
  if (minutes < 1) return rtf.format(0, "second");
  if (minutes < 60) return rtf.format(-minutes, "minute");
  if (minutes < 1440) return rtf.format(-Math.floor(minutes / 60), "hour");
  return rtf.format(-Math.floor(minutes / 1440), "day");
}

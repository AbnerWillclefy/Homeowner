/**
 * The zones to choose from: the browser's list, plus the Home's current zone when the browser does not
 * list it (for example an older alias), so the select can always show what is saved.
 */
export function timezoneOptions(supported: readonly string[], current?: string): string[] {
  const zones = [...supported];
  if (current && !zones.includes(current)) {
    zones.push(current);
    zones.sort();
  }
  return zones;
}

/** A new Home starts in the browser's own zone when listed, else the first one. Empty when there are none. */
export function defaultTimezone(supported: readonly string[], browserZone: string | undefined): string {
  if (browserZone && supported.includes(browserZone)) return browserZone;
  return supported[0] ?? "";
}

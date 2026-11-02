/** How far back a Completion may be moved, in Home days before today: the server's `too_old` rule (ADR 0018). */
const BACK_DAYS = 29;

/** The instants a Completion may be moved to, both included. */
export interface TimeBounds {
  min: Date;
  max: Date;
}

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The wall-clock parts of an instant in a zone, as numbers. */
function partsIn(at: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const n = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { y: n("year"), mo: n("month"), d: n("day"), h: n("hour"), mi: n("minute"), s: n("second") };
}

/** How far the zone's clock is ahead of UTC at an instant, in ms. */
function offsetAt(at: number, timeZone: string): number {
  const p = partsIn(at, timeZone);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(at / 1000) * 1000;
}

/** The instant a wall-clock reading (given as if UTC) falls on in a zone. The second pass settles a DST edge. */
function instantIn(wallAsUtc: number, timeZone: string): Date {
  const first = wallAsUtc - offsetAt(wallAsUtc, timeZone);
  return new Date(wallAsUtc - offsetAt(first, timeZone));
}

/**
 * The window a Completion can move within: from the first instant of `today - 29` in the Home's zone to now. `today`
 * is the Home's date (YYYY-MM-DD) and `timeZone` the Home's zone, never the device's, so it agrees with the server.
 */
export function completionBounds(now: Date, today: string, timeZone: string): TimeBounds {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  return { min: instantIn(Date.UTC(y, m - 1, d - BACK_DAYS), timeZone), max: now };
}

const two = (n: number) => String(n).padStart(2, "0");

/** An instant as the `YYYY-MM-DDTHH:mm` value of a `datetime-local` input, in the device's zone unless one is given. */
export function toLocalInput(at: Date | string, timeZone: string = deviceZone()): string {
  const p = partsIn(new Date(at).getTime(), timeZone);
  return `${p.y}-${two(p.mo)}-${two(p.d)}T${two(p.h)}:${two(p.mi)}`;
}

/** The instant a `datetime-local` value means in the device's zone (or the one given). Null when it is not a real time. */
export function fromLocalInput(value: string, timeZone: string = deviceZone()): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [y, mo, d, h, mi] = match.slice(1).map(Number) as [number, number, number, number, number];
  const wall = new Date(Date.UTC(y, mo - 1, d, h, mi));
  // A date such as 2030-13-45 rolls over in Date.UTC; reading it back tells the two apart.
  if (wall.getUTCFullYear() !== y || wall.getUTCMonth() !== mo - 1 || wall.getUTCDate() !== d || wall.getUTCHours() !== h) return null;
  return instantIn(wall.getTime(), timeZone);
}

/**
 * The instant a picked value means, or why it cannot be sent. iOS Safari ignores `min` and `max` on `datetime-local`,
 * so Save asks this again before calling the API.
 */
export function parsePicked(
  value: string,
  bounds: TimeBounds,
  timeZone: string = deviceZone(),
): { date: Date } | { problem: "in_future" | "too_old" | "invalid" } {
  const date = fromLocalInput(value, timeZone);
  if (date === null) return { problem: "invalid" };
  if (date > bounds.max) return { problem: "in_future" };
  if (date < bounds.min) return { problem: "too_old" };
  return { date };
}

/** Why a picked value cannot be sent, or null when it can. */
export function pickedProblem(value: string, bounds: TimeBounds, timeZone: string = deviceZone()) {
  const picked = parsePicked(value, bounds, timeZone);
  return "problem" in picked ? picked.problem : null;
}

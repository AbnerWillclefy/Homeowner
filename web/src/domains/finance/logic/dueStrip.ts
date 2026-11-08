import type { Bill } from "../api/api";
import type { Month } from "./month";

export interface StripDay {
  day: number;
  bills: Bill[];
}

/** Every day of `month` with the Bills due on it, and today's day number (null when today is in another month). */
export function dueStrip(bills: Bill[], month: Month, today: string): { days: StripDay[]; today: number | null } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const days = Array.from({ length: new Date(y, m, 0).getDate() }, (_, i): StripDay => ({ day: i + 1, bills: [] }));
  // The server clamps a dueDay of 31, so a dueDate always lands inside the month.
  for (const bill of bills) days[Number(bill.dueDate.slice(8)) - 1]?.bills.push(bill);
  return { days, today: today.startsWith(`${month}-`) ? Number(today.slice(8)) : null };
}

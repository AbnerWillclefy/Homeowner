import type { Bill } from "../../bills/api";

const dayNumber = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000;

/** The unpaid Bills in due order, what they add up to and how far the first is. `today` is null for a past month (no days to count). */
export function billsAlert(bills: Bill[], today: string | null) {
  const unpaid = bills.filter((b) => !b.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const firstDue = unpaid[0]?.dueDate ?? null;
  return {
    unpaid,
    totalCents: unpaid.reduce((n, b) => n + b.expectedCents, 0),
    firstDue,
    lastDue: unpaid.at(-1)?.dueDate ?? null,
    daysToFirst: firstDue !== null && today !== null ? dayNumber(firstDue) - dayNumber(today) : null,
  };
}

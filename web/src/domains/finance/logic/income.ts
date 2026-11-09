import { parseMoney } from "./money";

const MAX_CENTS = 1_000_000_000_000; // backend maxIncomeCents and maxBillCents

export type IncomeProblem = "empty" | "zero" | "junk";

/** What the User typed in Monthly income: cents, or the one problem to tell them about. */
export function readIncome(text: string): { cents: number } | { problem: IncomeProblem } {
  if (text.trim() === "") return { problem: "empty" };
  const cents = parseMoney(text);
  if (cents === null || cents > MAX_CENTS) return { problem: "junk" };
  return cents === 0 ? { problem: "zero" } : { cents };
}

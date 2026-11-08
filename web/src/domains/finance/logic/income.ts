import { parseMoney } from "./money";

export type IncomeProblem = "empty" | "zero" | "junk";

/** What the User typed in Monthly income: cents, or the one problem to tell them about. */
export function readIncome(text: string): { cents: number } | { problem: IncomeProblem } {
  if (text.trim() === "") return { problem: "empty" };
  const cents = parseMoney(text);
  if (cents === null) return { problem: "junk" };
  return cents === 0 ? { problem: "zero" } : { cents };
}

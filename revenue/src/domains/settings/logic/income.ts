const MAX_CENTS = 1_000_000_000_000; // backend maxIncomeCents

export type IncomeProblem = "empty" | "zero" | "junk";

/** The money field's cents (null when empty or not an amount): the amount to send, or the one problem to tell the User about. */
export function readIncome(cents: number | null): { cents: number } | { problem: IncomeProblem } {
  if (cents === null) return { problem: "empty" };
  if (cents === 0) return { problem: "zero" };
  return cents < 0 || cents > MAX_CENTS ? { problem: "junk" } : { cents };
}

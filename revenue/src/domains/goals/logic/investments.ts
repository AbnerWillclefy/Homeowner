import type { Investment, InvestmentInput, Serves } from "../api";
import type { FormResult } from "./savings";

const MAX_NAME = 60; // backend maxInvestmentName

/** A value of zero is fine (an Investment the User emptied but keeps), unlike a Goal's target. */
export function investmentInputOf(f: { name: string; cents: number | null; serves: Serves | null }): FormResult<{ input: InvestmentInput }> {
  const errors: Record<string, string> = {};
  const name = f.name.trim();
  if (name === "") errors.name = "required";
  else if ([...name].length > MAX_NAME) errors.name = "too_long";
  if (f.cents === null || f.cents < 0) errors.valueCents = "invalid";
  if (!f.serves) errors.serves = "invalid";
  if (f.cents === null || !f.serves || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input: { name, valueCents: f.cents, serves: f.serves } };
}

export type InvestmentGroup = { serves: Serves | "none"; items: Investment[] };

/** The Investments by what they count toward; "none" is a bank one nothing is picked for. Empty groups are left out. */
export function groupInvestments(investments: Investment[]): InvestmentGroup[] {
  return (["reserve", "goals", "none"] as const)
    .map((serves) => ({ serves, items: investments.filter((i) => (i.serves ?? "none") === serves) }))
    .filter((g) => g.items.length > 0);
}

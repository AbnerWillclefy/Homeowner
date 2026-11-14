import { meQuery } from "../../domains/auth/api/queries";
import { checkInQuery } from "../../domains/checkin/api/queries";
import { dayPlanQuery } from "../../domains/dayplan/api/queries";
import { homeQuery } from "../../domains/home/api/queries";
import { billsQuery, billSuggestionsQuery, commitmentsQuery, financeStatusQuery, savingsQuery } from "../../domains/finance/api/queries";
import { onboardingQuery } from "../../domains/onboarding/api/queries";
import { demandsQuery } from "../../domains/profile/api/queries";
import { residentsQuery } from "../../domains/residents/api/queries";
import { streakQuery } from "../../domains/streak/api/queries";
import type { BootSections } from "./boot";
import { normalizePath, TODAY_PATH } from "./routes";

/** Everything Today shows, plus the two reads the Guard decides from. All start together (ADR 0016). */
const TODAY_READS = [
  meQuery,
  onboardingQuery,
  homeQuery,
  dayPlanQuery,
  checkInQuery,
  streakQuery,
  residentsQuery,
  demandsQuery,
] as const;

/**
 * The reads to start before the first render (ADR 0016): all of Today's on the Today path with a stored session,
 * nothing on any other path or without a session. Pure; `main.tsx` passes the location and whether a session is
 * stored, and prefetches what comes back.
 */
export function launchReads(pathname: string, hasStoredSession: boolean): typeof TODAY_READS | readonly [] {
  if (!hasStoredSession || normalizePath(pathname) !== TODAY_PATH) return [];
  return TODAY_READS;
}

/**
 * The finance reads whose section the boot carries, in the same shape the Finances tab asks for them, so the cache is
 * seeded and opening Finances asks nothing. A section that failed is left to the tab's own read.
 */
export function financeLaunchReads(sections: BootSections, month: string) {
  const reads = [
    ["/me/finance", financeStatusQuery],
    [`/me/finance/bills?month=${month}`, billsQuery(month)],
    [`/me/finance/commitments?from=${month}`, commitmentsQuery(month)],
    ["/me/finance/savings", savingsQuery],
    ["/me/finance/bill-suggestions", billSuggestionsQuery],
  ] as const;
  return reads.filter(([key]) => (sections[key]?.status ?? 500) < 500).map(([, query]) => query);
}

import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { meQuery } from "../../domains/auth/api/queries";
import { checkInQuery } from "../../domains/checkin/api/queries";
import { dayPlanQuery } from "../../domains/dayplan/api/queries";
import { homeQuery } from "../../domains/home/api/queries";
import { onboardingQuery } from "../../domains/onboarding/api/queries";
import { demandsQuery } from "../../domains/profile/api/queries";
import { residentsQuery } from "../../domains/residents/api/queries";
import { streakQuery } from "../../domains/streak/api/queries";
import { normalizePath, TODAY_PATH } from "./routes";

/** Any query's options, so the list can hold queries of different data types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LaunchRead = UseQueryOptions<any, any, any, QueryKey>;

/** Everything Today shows, plus the two reads the Guard decides from. All start together (ADR 0016). */
const TODAY_READS: readonly LaunchRead[] = [
  meQuery,
  onboardingQuery,
  homeQuery,
  dayPlanQuery,
  checkInQuery,
  streakQuery,
  residentsQuery,
  demandsQuery,
];

/**
 * The reads to start before the first render (ADR 0016): all of Today's on the Today path with a stored session,
 * nothing on any other path or without a session. Pure; `main.tsx` passes the location and whether a session is
 * stored, and prefetches what comes back.
 */
export function launchReads(pathname: string, hasStoredSession: boolean): readonly LaunchRead[] {
  if (!hasStoredSession || normalizePath(pathname) !== TODAY_PATH) return [];
  return TODAY_READS;
}

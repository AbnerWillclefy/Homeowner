import { queryOptions } from "@tanstack/react-query";
import { toQueryData } from "../../../shared/query/ApiFailure";
import { getDayPlan, type DayPlan } from "./api";

/**
 * `GET /home/day-plan`, under the Home's key so a join or leave clears it (ADR 0013). There is no date in the key:
 * "today" is the Home's local day and the server decides it, so a device clock would be wrong across time zones
 * and at midnight. The day is scoped by refetching on mount and on window focus.
 */
export const dayPlanKey = ["home", "day-plan"] as const;

/** Today's Day Plan, or null when the caller has no Home. The queryFn throws an `ApiFailure` on a failed call. */
export const dayPlanQuery = queryOptions({
  queryKey: dayPlanKey,
  queryFn: async (): Promise<DayPlan | null> => toQueryData(await getDayPlan())?.plan ?? null,
});

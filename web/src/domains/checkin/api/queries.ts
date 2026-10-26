import { queryOptions } from "@tanstack/react-query";
import { toQueryData } from "../../../shared/query/ApiFailure";
import { refetchUnlessSucceeded } from "../../../shared/query/queryClient";
import { getCheckIn, type CheckIn } from "./api";

/** `GET /home/check-in`, under the Home's key. No date in it: the server decides the Home's day (see `dayPlanKey`). */
export const checkInKey = ["home", "check-in"] as const;

/** Today's Check-in, or null when the caller has no Home. The queryFn throws an `ApiFailure` on a failed call. */
export const checkInQuery = queryOptions({
  queryKey: checkInKey,
  queryFn: async (): Promise<CheckIn | null> => toQueryData(await getCheckIn())?.checkIn ?? null,
  refetchOnMount: refetchUnlessSucceeded,
});

import { queryOptions } from "@tanstack/react-query";
import { toQueryData } from "../../../shared/query/ApiFailure";
import { getStreak, type Streak } from "./api";

/** `GET /home/streak`, under the Home's key. */
export const streakKey = ["home", "streak"] as const;

/** The current Streak, or null when the caller has no Home. The queryFn throws an `ApiFailure` on a failed call. */
export const streakQuery = queryOptions({
  queryKey: streakKey,
  queryFn: async (): Promise<Streak | null> => toQueryData(await getStreak())?.streak ?? null,
});

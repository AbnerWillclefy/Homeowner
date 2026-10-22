import type { QueryClient } from "@tanstack/react-query";
import { streakKey } from "../../streak/api/queries";
import { dayPlanKey } from "../api/queries";
import type { DayPlan } from "../api/api";

/**
 * Puts the plan the server answered into the cache. A read of the Day Plan that is still running is cancelled
 * first, so its older answer cannot land after this one and bring the old plan back. Nothing here is optimistic.
 */
export async function writeActionAnswer(client: QueryClient, plan: DayPlan): Promise<void> {
  await client.cancelQueries({ queryKey: dayPlanKey });
  client.setQueryData(dayPlanKey, plan);
}

/** A Completion changes the Streak: mark it stale, and read it again if Today is showing it. */
export function afterCompletion(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: streakKey });
}

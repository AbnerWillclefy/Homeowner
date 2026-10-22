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

/**
 * An action the server accepted may change the Streak: a Completion does, and so can a Task taken or swapped,
 * because the Streak reads who holds today's Tasks. Mark it stale, and read it again if Today is showing it.
 */
export function invalidateStreak(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: streakKey });
}

/**
 * A plan the server answered to an accepted action: written to the cache, then the Streak is marked stale (see
 * `invalidateStreak`). A plan read after a 409 is not an accepted action and goes through `writeActionAnswer`.
 */
export async function writeAcceptedAnswer(client: QueryClient, plan: DayPlan): Promise<void> {
  await writeActionAnswer(client, plan);
  void invalidateStreak(client);
}

/** Marks the Day Plan stale, and reads it again if Today is showing it: after a Check-in, a start choice or a join. */
export function invalidateDayPlan(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: dayPlanKey });
}

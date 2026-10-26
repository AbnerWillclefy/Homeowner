import { useCallback } from "react";
import { useLaunchStaleTime } from "../../../shared/query/useLaunchStaleTime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { putCheckIn, type Level } from "../api/api";
import { checkInKey, checkInQuery } from "../api/queries";
import { invalidateDayPlan } from "../../dayplan/logic/planCache";
import { demandsQuery } from "../../profile/api/queries";
import { viewOf } from "../../../shared/query/view";
import { checkInStateOf, type SaveFailure } from "../logic/state";

/**
 * Today's Check-in and the Demand list the form offers, read through the query cache (the Demand list is the same
 * entry the Chores tab uses), and a save of a new Check-in. After a save went through the Day Plan is invalidated,
 * because the API plans the Resident again when the plan exists. The Check-in itself is not read again after a
 * save, because it is written from the save's answer. `refreshing` is true while a read runs over data already
 * on screen. Mounted in the Shell, and reads only when `hasHome` is true (the state stays `loading` before that).
 */
export function useCheckIn(hasHome: boolean) {
  const queryClient = useQueryClient();
  // Mounted in the Shell, which is up before the Home is known: the launch read may already hold both entries.
  const staleTime = useLaunchStaleTime(hasHome);
  const checkInRead = useQuery({ ...checkInQuery, enabled: hasHome, staleTime });
  const demandsRead = useQuery({ ...demandsQuery, enabled: hasHome, staleTime });
  const checkInView = viewOf(checkInRead);
  const demandsView = viewOf(demandsRead);
  const { refetch: refetchCheckIn } = checkInRead;
  const { refetch: refetchDemands } = demandsRead;

  /** Retry: reads the Check-in and the Demand list again. */
  const reload = useCallback(async () => {
    await Promise.all([refetchCheckIn(), refetchDemands()]);
  }, [refetchCheckIn, refetchDemands]);

  const save = useCallback(
    /** Resolves to null when the Check-in was saved, so the dialog knows to close; else why it was not. */
    async (level: Level, restrictions: readonly string[]): Promise<SaveFailure | null> => {
      const result = await putCheckIn(level, restrictions);
      if (result.kind !== "ok") return result.kind;
      // A read that started before the save is cancelled first, so its older answer cannot bring the old one back.
      await queryClient.cancelQueries({ queryKey: checkInKey });
      queryClient.setQueryData(checkInKey, result.checkIn);
      // The API plans the Resident again, so the Day Plan is stale: mark it, and it is read once if Today shows it.
      // Not awaited: the dialog closes now, whether or not that read succeeds.
      void invalidateDayPlan(queryClient);
      return null;
    },
    [queryClient],
  );

  return {
    state: checkInStateOf(checkInView.state, demandsView.state),
    demands: demandsRead.data ?? [],
    refreshing: checkInView.refreshing || demandsView.refreshing,
    reload,
    save,
  };
}

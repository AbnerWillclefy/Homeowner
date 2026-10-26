import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCheckIn } from "../../domains/checkin/hooks/useCheckIn";
import { energyNote } from "../../domains/checkin/logic/state";
import { dayPlanQuery } from "../../domains/dayplan/api/queries";
import { plannedEffort } from "../../domains/dayplan/logic/plannedEffort";
import { useLaunchStaleTime } from "../../shared/query/useLaunchStaleTime";

/**
 * What the Shell reads on every tab for the top bar's Energy pill and shares with Today: the Check-in, the Day
 * Plan's Energy and the Effort planned for the Resident, the Energy note from the single rule (`energyNote`), and
 * the state of the one Check-in dialog. Today reads the same cache entries, so nothing is requested twice. The Day
 * Plan's actions stay in `useDayPlan`, on Today.
 */
export function useShellCheckIn(hasHome: boolean) {
  const checkIn = useCheckIn(hasHome);
  const planStaleTime = useLaunchStaleTime(hasHome);
  const planRead = useQuery({ ...dayPlanQuery, enabled: hasHome, staleTime: planStaleTime });
  const plan = planRead.data ?? null;
  const energy = plan?.energy ?? null;
  const checkInToday = checkIn.state.kind === "ready" ? checkIn.state.checkIn : null;
  const note = checkInToday ? energyNote(energy, checkInToday) : null;
  const planned = plannedEffort(plan);

  const [checkInOpen, setCheckInOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openCheckIn = useCallback((returnFocusTo?: HTMLElement) => {
    returnFocusRef.current = returnFocusTo ?? null;
    setCheckInOpen(true);
  }, []);
  const close = useCallback(() => setCheckInOpen(false), []);

  return { checkIn, note, energy, planned, dialog: { openCheckIn, checkInOpen, returnFocusRef, close } };
}

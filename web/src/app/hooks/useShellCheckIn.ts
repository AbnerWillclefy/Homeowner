import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCheckIn } from "../../domains/checkin/hooks/useCheckIn";
import { energyNote } from "../../domains/checkin/logic/state";
import { dayPlanQuery } from "../../domains/dayplan/api/queries";
import { plannedEffort } from "../../domains/dayplan/logic/plannedEffort";
import { useLaunchStaleTime } from "../../shared/query/useLaunchStaleTime";

/**
 * What the Shell reads on every tab for the top bar's Energy pill and shares with Today: the Check-in, the Day
 * Plan's Energy, the Energy note from the single rule (`energyNote`), and the state of the one Check-in dialog. Today reads the same cache entries, so nothing is requested twice. The Day
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

  // Shown in the dialog only when there is Energy to plan against.
  const planned = note === "energy" && energy !== null ? { planned: plannedEffort(plan), energy } : null;

  // The date of the Check-in the dialog is open for, or null while closed. Opened by the pill, or latched by the Shell
  // when the dialog shows by itself, so a refetch (saved on another device, midnight) cannot unmount the form.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const openCheckIn = useCallback(
    (returnFocusTo?: HTMLElement) => {
      if (checkInToday === null) return;
      returnFocusRef.current = returnFocusTo ?? null;
      setOpenFor(checkInToday.date);
    },
    [checkInToday],
  );
  // Opening by itself has no opener, so drop one left from an earlier open: focus returns to the pill.
  const latchCheckIn = useCallback((date: string) => {
    returnFocusRef.current = pillRef.current;
    setOpenFor((current) => current ?? date);
  }, []);
  const closeCheckIn = useCallback(() => setOpenFor(null), []);

  return { checkIn, note, energy, planned, openCheckIn, openFor, closeCheckIn, latchCheckIn, pillRef, returnFocusRef };
}

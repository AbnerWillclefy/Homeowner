import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Level } from "../../domains/checkin/api/api";
import { useCheckIn } from "../../domains/checkin/hooks/useCheckIn";
import { energyNote } from "../../domains/checkin/logic/state";
import { dayPlanQuery } from "../../domains/dayplan/api/queries";
import { useLaunchStaleTime } from "../../shared/query/useLaunchStaleTime";

/**
 * What the Shell reads on every tab for Today's hero card and shares with Today: the Check-in, the Day
 * Plan's Energy, the Energy note from the single rule (`energyNote`), and the state of the one Check-in Sheet. Today reads the same cache entries, so nothing is requested twice. The Day
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

  // The date of the Check-in the Sheet is open for, or null while closed. Opened from Today, or latched by the Shell
  // when the Sheet shows by itself, so a refetch (saved on another device, midnight) cannot unmount the form.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  // The level picked on the hero card, which opens the Sheet with it ticked. Cleared on close, so an automatic open never has one.
  const [chosenLevel, setChosenLevel] = useState<Level | null>(null);
  const openCheckIn = useCallback(
    (returnFocusTo?: HTMLElement, level?: Level) => {
      if (checkInToday === null) return;
      returnFocusRef.current = returnFocusTo ?? null;
      setChosenLevel(level ?? null);
      setOpenFor(checkInToday.date);
    },
    [checkInToday],
  );
  // Opening by itself has no opener, so drop one left from an earlier open: focus returns to the hero card.
  const latchCheckIn = useCallback((date: string) => {
    returnFocusRef.current = heroRef.current;
    setOpenFor((current) => current ?? date);
  }, []);
  const closeCheckIn = useCallback(() => {
    setOpenFor(null);
    setChosenLevel(null);
  }, []);

  return { checkIn, note, energy, openCheckIn, openFor, closeCheckIn, latchCheckIn, heroRef, returnFocusRef, chosenLevel };
}

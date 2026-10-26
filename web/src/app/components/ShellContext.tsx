import { createContext, useContext } from "react";
import type { useCheckIn } from "../../domains/checkin/hooks/useCheckIn";
import type { EnergyNote } from "../../domains/checkin/logic/state";
import type { useHome } from "../../domains/home/hooks/useHome";
import type { useMe } from "../../domains/profile/hooks/useMe";
import type { useResidents } from "../../domains/residents/hooks/useResidents";
import type { useStreak } from "../../domains/streak/hooks/useStreak";

interface ShellValue {
  home: ReturnType<typeof useHome>;
  /** The Home's Residents, shared so every screen reads one copy. Not ready until there is a Home. */
  residents: ReturnType<typeof useResidents>;
  /** The signed-in User's own name and photo from `GET /me`. */
  me: ReturnType<typeof useMe>;
  /** The Streak, read once the Home is ready and shown in the top bar. */
  streak: ReturnType<typeof useStreak>;
  /** Today's Check-in and the Demand list, read once here for the pill, the dialog and Today. The one owner of `save`. */
  checkIn: ReturnType<typeof useCheckIn>;
  /** The Energy note, from the single rule (`energyNote`). Null until the Check-in is ready. */
  note: EnergyNote | null;
  /** The Day Plan's Energy, or null before there is a plan. */
  energy: number | null;
  /**
   * Opens the one Check-in dialog. `returnFocusTo` is the control that opened it (the pill, the card's button): Escape
   * and Cancel put focus back there, because iOS Safari does not focus a tapped button. Does nothing until the
   * Check-in is ready.
   */
  openCheckIn(returnFocusTo?: HTMLElement): void;
}

export const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const value = useContext(ShellContext);
  if (value === null) throw new Error("useShell needs the Shell");
  return value;
}

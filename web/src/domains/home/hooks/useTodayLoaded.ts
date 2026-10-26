import { useState } from "react";
import { todayLoaded, type TodayReads } from "../logic/todayLoaded";

/**
 * Whether Today has swapped in from its skeleton: true from the first render in which every read has answered
 * (data or failure, see `todayLoaded`), and it stays true. A Retry after a failure makes that one section load
 * again, and the section shows its own skeleton in place rather than bringing the whole page back.
 */
export function useTodayLoaded(reads: TodayReads): boolean {
  const [swapped, setSwapped] = useState(false);
  const settled = todayLoaded(reads);
  // Set during render, so the render that first settles already counts as swapped and no frame is wasted.
  if (settled && !swapped) setSwapped(true);
  return settled || swapped;
}

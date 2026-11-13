import { useSearchParams } from "react-router";
import { addMonths, monthFromParam, type Month } from "../logic/month";
import { saoPauloDay } from "../logic/today";

/**
 * The month the Overview shows, kept in `?month=` so a reload keeps it, and São Paulo's today, worked out on every
 * render so a resumed app is not stuck on the day it opened. This month leaves the URL bare; stepping replaces the history entry.
 */
export function useOverviewMonth() {
  const [params, setParams] = useSearchParams();
  const today = saoPauloDay(new Date());
  const thisMonth = today.slice(0, 7);
  const month: Month = monthFromParam(params.get("month"), thisMonth);
  const step = (n: number) => {
    const next = addMonths(month, n);
    setParams(next >= thisMonth ? {} : { month: next }, { replace: true });
  };
  return { month, thisMonth, today: month === thisMonth ? today : null, step };
}

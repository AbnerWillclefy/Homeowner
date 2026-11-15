import { useSearchParams } from "react-router";
import { monthFromParam, saoPauloDay, type Month } from "./month";

/** The month in `?month=` (this month when absent, future or malformed). Choosing this month leaves the URL bare. */
export function useMonthParam() {
  const [params, setParams] = useSearchParams();
  const today = saoPauloDay(new Date());
  const thisMonth = today.slice(0, 7);
  const month = monthFromParam(params.get("month"), thisMonth);
  // Other params (a screen's `?card=`) survive a change of month.
  const setMonth = (next: Month) =>
    setParams((old) => {
      const params = new URLSearchParams(old);
      if (next >= thisMonth) params.delete("month");
      else params.set("month", next);
      return params;
    }, { replace: true });
  return { month, thisMonth, today, setMonth };
}

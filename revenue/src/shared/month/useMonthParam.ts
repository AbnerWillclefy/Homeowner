import { useSearchParams } from "react-router";
import { monthFromParam, saoPauloDay, type Month } from "./month";

/** The month in `?month=` (this month when absent, future or malformed). Choosing this month leaves the URL bare. */
export function useMonthParam() {
  const [params, setParams] = useSearchParams();
  const today = saoPauloDay(new Date());
  const thisMonth = today.slice(0, 7);
  const month = monthFromParam(params.get("month"), thisMonth);
  const setMonth = (next: Month) => setParams(next >= thisMonth ? {} : { month: next }, { replace: true });
  return { month, thisMonth, today, setMonth };
}

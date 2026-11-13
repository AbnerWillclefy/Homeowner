import { useSearchParams } from "react-router";
import { addMonths, monthFromParam, saoPauloDay } from "../logic/month";

/** The month in `?month=` (this month when absent or invalid) and a stepper. This month leaves the URL bare. */
export function useMonthParam() {
  const [params, setParams] = useSearchParams();
  const thisMonth = saoPauloDay(new Date()).slice(0, 7);
  const month = monthFromParam(params.get("month"), thisMonth);
  const step = (n: number) => {
    const next = addMonths(month, n);
    setParams(next >= thisMonth ? {} : { month: next }, { replace: true });
  };
  return { month, thisMonth, step };
}

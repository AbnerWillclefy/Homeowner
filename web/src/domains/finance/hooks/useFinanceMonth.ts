import { useSearchParams } from "react-router";
import { addMonths, currentMonth, monthFromParam, type Month } from "../logic/month";

/**
 * The month a Finances view shows, kept in `?month=` so a reload or a switch between Resumo, Gastos and Contas keeps
 * it. This month leaves the URL bare. Stepping replaces the history entry, so Back leaves Finances, not the month.
 */
export function useFinanceMonth(): { month: Month; thisMonth: Month; step: (n: number) => void } {
  const [params, setParams] = useSearchParams();
  const thisMonth = currentMonth(new Date());
  const month = monthFromParam(params.get("month"), thisMonth);
  const step = (n: number) => {
    const next = addMonths(month, n);
    setParams(next >= thisMonth ? {} : { month: next }, { replace: true });
  };
  return { month, thisMonth, step };
}

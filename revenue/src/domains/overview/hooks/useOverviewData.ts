import { useQuery } from "@tanstack/react-query";
import { getBills, getCommitments, getMonthTransactions } from "../api/api";

/** Three independent reads, so one failing hides only its own block. The key carries the month, so a late answer for another month lands in its own entry. */
export function useCommitments(month: string) {
  return useQuery({
    queryKey: ["finance", "commitments", month],
    queryFn: async () => {
      const result = await getCommitments(month);
      const first = result.months.find((m) => m.month === month);
      if (!first) throw new Error("the commitments did not include the month");
      return { monthlyIncomeCents: result.monthlyIncomeCents, month: first };
    },
  });
}

export const useBills = (month: string) => useQuery({ queryKey: ["finance", "bills", month], queryFn: () => getBills(month) });

export const useMonthTransactions = (month: string) =>
  useQuery({ queryKey: ["finance", "transactions", month], queryFn: () => getMonthTransactions(month) });

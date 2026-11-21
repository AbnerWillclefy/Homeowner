import { useQuery } from "@tanstack/react-query";
import { getCommitments, getHistory } from "../api/api";

// Both give a Block what it needs: the data, whether the read failed with nothing to show, and a way to read again.

/** The month's commitments. The key carries the month, so a late answer for another month lands in its own entry. */
export function useCommitments(month: string) {
  const query = useQuery({
    queryKey: ["finance", "commitments", month],
    queryFn: async () => {
      const result = await getCommitments(month);
      const first = result.months.find((m) => m.month === month);
      if (!first) throw new Error("the commitments did not include the month");
      return { monthlyIncomeCents: result.monthlyIncomeCents, month: first };
    },
  });
  return { data: query.data, failed: query.isError && !query.data, reload: () => void query.refetch() };
}

/** This month and the one before, for the result and its change. */
export function useHistory(month: string) {
  const query = useQuery({ queryKey: ["finance", "history", month, 2, "result"], queryFn: () => getHistory(month, 2) });
  return { data: query.data, failed: query.isError && !query.data, reload: () => void query.refetch() };
}

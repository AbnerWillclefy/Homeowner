import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { deleteCredentials, deleteFinanceData, getCredentialsSaved, getMonthlyIncome, putCredentials, putIncome } from "../api";

const incomeKey = ["finance", "commitments", "income"] as const;
const savedKey = ["finance", "status", "credentials"] as const;

/** The Monthly income the API holds (null when none) and the write. A change moves the Leftover and the Daily allowance, so every finance read is marked stale. */
export function useIncome() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: incomeKey, queryFn: getMonthlyIncome });
  const save = async (cents: number | null) => {
    const result = await putIncome(cents);
    if (result.kind === "ok") await client.invalidateQueries({ queryKey: ["finance"] });
    return result.kind === "ok";
  };
  return { income: query.data, failed: query.isError, loading: query.isPending, save };
}

/** Whether credentials are saved, and the writes. */
export function useCredentials() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: savedKey, queryFn: getCredentialsSaved });
  const refresh = () => client.invalidateQueries({ queryKey: ["finance"] });
  const save = async (clientId: string, clientSecret: string) => {
    const result = await putCredentials(clientId, clientSecret);
    if (result.kind === "ok") await refresh();
    return result.kind;
  };
  const remove = async () => {
    const result = await deleteCredentials();
    if (result.kind === "ok") await refresh();
    return result.kind === "ok";
  };
  return { saved: query.data, loading: query.isPending, save, remove };
}

/** Deletes every finance table, marks every finance query stale and sends the User to the first-run flow. */
export function useDeleteFinanceData() {
  const client = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => {
      if ((await deleteFinanceData()).kind !== "ok") throw new Error("delete failed");
      await client.invalidateQueries({ queryKey: ["finance"] });
      await navigate("/onboarding");
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { createConnectToken, getSources, putSourceName, registerItem } from "../api";
import { connectBanks, type ConnectProblem } from "../logic/connectFlow";
import { openPluggyConnect } from "../logic/pluggyConnect";

const KEY = ["finance", "sources"] as const;

/** The Sources and the sync state. While a bank is importing it asks again every few seconds, so balances appear without a reload. */
export function useSources() {
  const query = useQuery({ queryKey: KEY, queryFn: getSources, refetchInterval: (q) => (q.state.data?.importing ? 5000 : false) });
  return { data: query.data, loading: query.isPending, failed: query.isError && !query.data, reload: () => void query.refetch() };
}

/** Pluggy Connect from a button: the new status replaces the list, and every other finance read is marked stale. */
export function useConnectBanks() {
  const client = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [problem, setProblem] = useState<ConnectProblem | null>(null);
  const [closed, setClosed] = useState(false);

  const connect = useCallback(async () => {
    setConnecting(true);
    setProblem(null);
    setClosed(false);
    await connectBanks(
      { createToken: createConnectToken, open: openPluggyConnect, register: registerItem },
      {
        connected: (status) => {
          client.setQueryData(KEY, status);
          void client.invalidateQueries({ queryKey: ["finance"] });
        },
        closed: () => setClosed(true),
        problem: setProblem,
      },
    );
    setConnecting(false);
  }, [client]);

  return { connect, connecting, problem, closed };
}

/** Saves or clears (null) one Source's own name, then reads the list again. */
export function useSaveSourceName() {
  const client = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string | null }) => {
      const result = await putSourceName(id, name);
      if (result.kind === "ok") await client.invalidateQueries({ queryKey: ["finance"] });
      return result;
    },
  });
  return (id: string, name: string | null) => mutateAsync({ id, name });
}

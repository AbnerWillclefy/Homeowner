import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { viewOf } from "../../../shared/query/view";
import {
  createConnectToken,
  deleteCredentials,
  deleteFinanceData,
  putCredentials,
  registerItem,
  type FinanceStatus,
  type WriteResult,
} from "../api/api";
import { financeDeleted, financeStatusKey, financeStatusQuery, writeFinanceStatus } from "../api/queries";
import { connectBanks, type ConnectProblem } from "../logic/connectFlow";
import { openPluggyConnect } from "../logic/pluggyConnect";

export type Busy = "save" | "remove" | "connect" | "delete" | null;
/** Where a problem shows: under the form, by the Connect button, or inside the delete dialog. */
export type ProblemArea = "form" | "connect" | "data";

const NO_STATUS: FinanceStatus = { configured: false, sources: [], importing: false, lastSyncedAt: null };

/**
 * The Finances tab's status and its actions. Credentials are passed straight to the API call and kept nowhere:
 * not in state, not in the query cache (the status has none), not in a log or a toast.
 */
export function useFinance() {
  const client = useQueryClient();
  const query = useQuery(financeStatusQuery);
  const { state, refreshing } = viewOf(query);
  const { refetch } = query;
  const [busy, setBusy] = useState<Busy>(null);
  const [problem, setProblem] = useState<{ area: ProblemArea; problem: ConnectProblem } | null>(null);
  const [closed, setClosed] = useState(false);
  // State lags a render behind a second tap in the same tick; a ref does not.
  const running = useRef(false);

  const current = useCallback(() => client.getQueryData<FinanceStatus>(financeStatusKey) ?? NO_STATUS, [client]);

  /** Runs one action at a time. A failed write puts its problem in `area`; resolves true on success. */
  const act = useCallback(async (name: Exclude<Busy, null>, area: ProblemArea, write: () => Promise<WriteResult>) => {
    if (running.current) return false;
    running.current = true;
    setBusy(name);
    setProblem(null);
    setClosed(false);
    try {
      const result = await write();
      if (result.kind !== "ok") {
        setProblem({ area, problem: result.kind });
        return false;
      }
      return true;
    } finally {
      running.current = false;
      setBusy(null);
    }
  }, []);

  const save = useCallback(
    async (clientId: string, clientSecret: string) => {
      const ok = await act("save", "form", () => putCredentials(clientId, clientSecret));
      if (ok) await writeFinanceStatus(client, { ...current(), configured: true });
      return ok;
    },
    [act, client, current],
  );

  const remove = useCallback(async () => {
    const ok = await act("remove", "data", deleteCredentials);
    if (ok) await writeFinanceStatus(client, { ...current(), configured: false });
    return ok;
  }, [act, client, current]);

  const deleteAll = useCallback(async () => {
    const ok = await act("delete", "data", deleteFinanceData);
    if (ok) await financeDeleted(client);
    return ok;
  }, [act, client]);

  const connect = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy("connect");
    setProblem(null);
    setClosed(false);
    try {
      await connectBanks(
        { createToken: createConnectToken, open: openPluggyConnect, register: registerItem },
        {
          connected: (status) => void writeFinanceStatus(client, status),
          closed: () => setClosed(true),
          problem: (kind) => setProblem({ area: "connect", problem: kind }),
        },
      );
    } finally {
      running.current = false;
      setBusy(null);
    }
  }, [client]);

  const clearProblem = useCallback(() => setProblem(null), []);
  const reload = useCallback(async () => void (await refetch()), [refetch]);

  return { state, refreshing, reload, busy, problem, closed, clearProblem, save, remove, deleteAll, connect };
}

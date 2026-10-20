import { useCallback, useEffect, useState } from "react";
import { getResident, type ResidentDetail } from "../api/api";

export type ResidentState =
  | { kind: "loading" }
  | { kind: "ready"; resident: ResidentDetail }
  /** The Resident is not in this Home (or the id is nonsense): a calm "not found", never a redirect. */
  | { kind: "not-found" }
  /** The call failed; `offline` says the service could not be reached. Retry loads again. */
  | { kind: "failed"; reason: "offline" | "error" };

/**
 * One Resident's page data. It loads on mount and again whenever `id` changes (a link from one page to another
 * reuses the component), going back to `loading` so the old person is never shown under the new name. `retry`
 * loads again from `loading`.
 */
export function useResident(id: string) {
  const [state, setState] = useState<ResidentState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let current = true;
    setState({ kind: "loading" });
    void getResident(id).then((result) => {
      if (!current) return;
      switch (result.kind) {
        case "ok":
          return setState({ kind: "ready", resident: result.resident });
        case "not-found":
        // No Home cannot reach this page through HomeGate; if it happens, "not found" is the honest neutral answer.
        case "none":
          return setState({ kind: "not-found" });
        case "offline":
          return setState({ kind: "failed", reason: "offline" });
        // A lost session ends in the guard's redirect to sign-in; until then this is an ordinary failure.
        case "not-signed-in":
        case "error":
          return setState({ kind: "failed", reason: "error" });
      }
    });
    return () => {
      current = false;
    };
  }, [id, attempt]);

  return { state, retry };
}

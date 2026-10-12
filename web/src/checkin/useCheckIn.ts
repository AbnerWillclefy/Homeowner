import { useCallback, useEffect, useReducer, useState } from "react";
import { getCheckIn, putCheckIn, type Level } from "../api/checkIn";
import { getDemands } from "../api/profile";
import { checkInReducer, type CheckInState } from "./state";

/**
 * Loads today's Check-in and the Demand list the form offers, and saves a new Check-in. `onSaved` runs after a
 * save went through, so the Day Plan can reload: the API plans the Resident again when the plan exists.
 * Only mounted with a Home.
 */
export function useCheckIn(onSaved: () => void) {
  const [state, dispatch] = useReducer(checkInReducer, { kind: "loading" } as CheckInState);
  const [demands, setDemands] = useState<string[]>([]);

  const load = useCallback(async () => {
    dispatch({ type: "load" });
    const [checkIn, demandList] = await Promise.all([getCheckIn(), getDemands()]);
    if (checkIn.kind !== "ok") return dispatch({ type: "load-failed", reason: checkIn.kind });
    if (demandList.kind !== "ok") return dispatch({ type: "load-failed", reason: demandList.kind });
    setDemands(demandList.ids);
    dispatch({ type: "loaded", checkIn: checkIn.checkIn });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    /** Resolves true when the Check-in was saved, so the dialog knows to close. */
    async (level: Level, restrictions: readonly string[]): Promise<boolean> => {
      dispatch({ type: "save-started" });
      const result = await putCheckIn(level, restrictions);
      if (result.kind !== "ok") {
        dispatch({ type: "save-failed", reason: result.kind });
        return false;
      }
      dispatch({ type: "saved", checkIn: result.checkIn });
      onSaved();
      return true;
    },
    [onSaved],
  );

  return {
    state,
    demands,
    reload: load,
    save,
    dismissFailure: () => dispatch({ type: "dismiss-failure" }),
  };
}

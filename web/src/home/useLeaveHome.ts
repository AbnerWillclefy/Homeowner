import { useReducer } from "react";
import { leaveHome } from "../api/home";
import { useSubmitOnce } from "../components/ui/useSubmitOnce";
import { leaveReducer } from "./leaveFlow";

/** Wires the leave flow to React. `onLeft` is called once the Resident is out of the Home. */
export function useLeaveHome(onLeft: () => void) {
  const [state, dispatch] = useReducer(leaveReducer, { kind: "closed" });

  // Destructive, so the guard ignores a second tap in the same tick, before the dialog has rendered "leaving".
  const { run: confirm } = useSubmitOnce(async () => {
    if (state.kind !== "confirming") return;
    dispatch({ type: "confirm" });
    const result = await leaveHome();
    // A Home that is already gone (none) is the outcome the Resident asked for.
    if (result.kind === "ok" || result.kind === "none") {
      dispatch({ type: "done" });
      onLeft();
    } else {
      dispatch({ type: "failed", reason: result.kind });
    }
  });

  return {
    state,
    open: () => dispatch({ type: "open" }),
    cancel: () => dispatch({ type: "cancel" }),
    confirm,
  };
}

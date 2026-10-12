import { useRef, useSyncExternalStore } from "react";
import { leaveHome } from "../api/home";
import { createLeaveFlow, type LeaveFlow } from "./leaveFlow";

/** Wires the leave flow to React. `onLeft` is called once the Resident is out of the Home. */
export function useLeaveHome(onLeft: () => void) {
  const latest = useRef(onLeft);
  latest.current = onLeft;
  const flowRef = useRef<LeaveFlow | null>(null);
  flowRef.current ??= createLeaveFlow({ leave: leaveHome, onLeft: () => latest.current() });
  const flow = flowRef.current;
  const state = useSyncExternalStore(flow.subscribe, flow.state);
  return { state, open: flow.open, cancel: flow.cancel, confirm: flow.confirm };
}

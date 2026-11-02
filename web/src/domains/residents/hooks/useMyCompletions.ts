import { useShell } from "../../../app/components/ShellContext";
import { myCompletionsStateOf, myResidentId } from "../logic/myCompletions";
import { useResident } from "./useResident";

/**
 * The caller's last 30 days of Completions for Me. The id is the `you` row of the Shell's Residents list, and
 * the read is the Resident page's own query for that id, so the two share one cache entry. `retry` runs again
 * whichever read failed. `refreshing` is true while a read runs over a history already on screen.
 */
export function useMyCompletions() {
  const { state: list, reload } = useShell().residents;
  const detail = useResident(myResidentId(list));
  const state = myCompletionsStateOf(list, detail.state);
  const retry = state.kind === "failed" && state.retry === "list" ? reload : detail.retry;
  return { state, refreshing: detail.refreshing, retry };
}

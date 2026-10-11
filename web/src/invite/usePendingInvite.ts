import { useCallback, useState } from "react";
import { captureInvite, clearPendingInvite } from "./pendingInvite";

/**
 * The Invite token this launch arrived with (or an earlier launch left behind), read once. `clear` forgets it
 * for good: after a join, or when the Invite turned out to be unusable.
 */
export function usePendingInvite() {
  const [token, setToken] = useState<string | null>(() => captureInvite());
  const clear = useCallback(() => {
    clearPendingInvite();
    setToken(null);
  }, []);
  return { token, clear };
}

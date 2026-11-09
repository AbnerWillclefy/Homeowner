import { useSyncExternalStore } from "react";

// Module state, not storage: a reload brings the mic back.
let hidden = false;
const listeners = new Set<() => void>();

export function hideMic() {
  hidden = true;
  listeners.forEach((l) => l());
}

export function useMicHidden(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => hidden,
  );
}

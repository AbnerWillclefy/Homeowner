import { useEffect, useState } from "react";
import { delayedFlag } from "./delayedFlag";

/** How long a load runs before a skeleton is worth showing. Faster loads show nothing extra. */
export const SKELETON_DELAY_MS = 300;

/** True once `active` has stayed true for `delayMs`; false at once when it ends. See `delayedFlag`. */
export function useDelayedFlag(active: boolean, delayMs: number = SKELETON_DELAY_MS): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const flag = delayedFlag(delayMs, setOn);
    flag.set(active);
    return () => {
      flag.dispose();
      setOn(false);
    };
  }, [active, delayMs]);

  return on && active;
}

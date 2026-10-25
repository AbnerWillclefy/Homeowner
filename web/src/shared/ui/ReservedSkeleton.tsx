import type { ReactNode } from "react";

/**
 * Holds a skeleton's space from the first frame and shows it only when `show` is true (the page's 300ms delay has
 * passed). Hidden, it is `invisible` (visibility: hidden keeps the box), so the page below never moves when it
 * appears or when the real content replaces it, and a load faster than 300ms never flashes it. The parts keep their
 * own `motion-safe:animate-pulse`, so the pulse starts once visible and only where motion is allowed. Always
 * `aria-hidden`: the page's one status speaks for the wait.
 */
export function ReservedSkeleton({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <div aria-hidden="true" className={show ? undefined : "invisible"}>
      {children}
    </div>
  );
}

import type { ReactNode } from "react";

/** The name of a group in a list, with an optional icon before it and how many it holds when there are any. */
export function GroupHeading({ count, icon, children }: { count?: number; icon?: ReactNode; children: ReactNode }) {
  return (
    <h3 className="mt-0 mb-3 flex items-center gap-2 text-xl font-bold [overflow-wrap:anywhere]">
      {icon}
      {children}
      {count !== undefined && count > 0 && <span className="text-base font-semibold text-muted">{count}</span>}
    </h3>
  );
}

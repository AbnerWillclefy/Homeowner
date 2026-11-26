import type { ReactNode } from "react";

/** The name of a group in a list, with an optional icon before it and how many it holds when there are any. */
export function GroupHeading({
  count,
  icon,
  action,
  children,
}: {
  count?: number;
  icon?: ReactNode;
  /** A quiet button at the end of the heading's row, such as "Aceitar todas". */
  action?: ReactNode;
  children: ReactNode;
}) {
  const heading = (
    <h3 className={`mt-0 ${action ? "mb-0" : "mb-3"} flex items-center gap-2 text-xl font-bold [overflow-wrap:anywhere]`}>
      {icon}
      {children}
      {count !== undefined && count > 0 && <span className="text-base font-semibold text-muted">{count}</span>}
    </h3>
  );
  return action ? <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4">{heading}{action}</div> : heading;
}

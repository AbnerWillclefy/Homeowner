import type { HTMLAttributes } from "react";

/** A wrapping row of buttons. Pass spacing (e.g. `mt-4`) through className. */
export function ButtonRow({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex flex-wrap gap-2 ${className}`.trim()} {...rest} />;
}

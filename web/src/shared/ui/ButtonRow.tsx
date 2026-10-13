import type { HTMLAttributes } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** Stack the buttons, each the full width, for a card's main actions. */
  stretch?: boolean;
}

/** A wrapping row of buttons. Pass spacing (e.g. `mt-4`) through className. */
export function ButtonRow({ stretch = false, className = "", ...rest }: Props) {
  const layout = stretch ? "flex flex-col gap-2" : "flex flex-wrap gap-2";
  return <div className={`${layout} ${className}`.trim()} {...rest} />;
}

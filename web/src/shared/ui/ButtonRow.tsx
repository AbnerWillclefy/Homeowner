import type { HTMLAttributes, ReactNode } from "react";

type Base = Omit<HTMLAttributes<HTMLDivElement>, "children">;

/** Grouped: deliberate actions in `start`, the expected one in `end`. */
interface Grouped extends Base {
  /** Deliberate actions, on the left (for example Cancel). A row with only `start` is allowed: a lone deliberate action such as "Leave this Home" sits on the left. */
  start?: ReactNode;
  /** The expected action, on the right, with the primary last (for example Save). Alone, it still sits at the right. */
  end?: ReactNode;
  children?: never;
  /** Always stack both groups, each button full width, the primary last: for a short dialog with two actions. */
  stretch?: boolean;
}

/** Ungrouped, for callers not yet migrated. */
interface Plain extends Base {
  start?: never;
  end?: never;
  children?: ReactNode;
  /** Stack the buttons, each the full width, for a card's main actions. */
  stretch?: boolean;
}

type Props = Grouped | Plain;

// A group is a wrapping row of its own. When even it does not fit the row (a narrow container or a large text
// size, since the query is in rem), it stacks and each button spans the width, so the primary ends up last and full.
const GROUP = "flex flex-wrap gap-2 @max-[14rem]:w-full @max-[14rem]:flex-col @max-[14rem]:*:w-full";
const STACKED = "flex w-full flex-col gap-2 *:w-full";

/**
 * A wrapping row of buttons. Put the deliberate actions in `start` and the expected one in `end`: on one line they
 * sit at the two edges; when they do not fit, the end group drops to its own line, still on the right; when that
 * does not fit either, everything stacks with the primary last. `stretch` stacks them always, for a short dialog.
 * `children` remain for callers not yet migrated. Pass spacing (e.g. `mt-4`) through className.
 */
export function ButtonRow({ start, end, stretch = false, className = "", children, ...rest }: Props) {
  // Only a grouped row is a container: containment would change how the existing children-only rows size.
  const grouped = start != null || end != null;
  const group = grouped && stretch ? STACKED : GROUP;
  const layout = grouped
    ? "@container flex w-full flex-wrap gap-2"
    : stretch
      ? "flex flex-col gap-2"
      : "flex flex-wrap gap-2";
  return (
    <div className={`${layout} ${className}`.trim()} {...rest}>
      {start != null && <div className={group}>{start}</div>}
      {end != null && <div className={`${group} ms-auto justify-end`}>{end}</div>}
      {children}
    </div>
  );
}

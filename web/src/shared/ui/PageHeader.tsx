import type { ReactNode, Ref } from "react";
import { PageFetchingSlot } from "./PageLoading";

interface Props {
  title: ReactNode;
  /** One short line under the title, in muted text. */
  children?: ReactNode;
  /** How many the page holds, drawn as a muted figure after the title (as `GroupHeading` does). Left out at 0. */
  count?: number;
  /** Less space below, for a page whose first line of content belongs to the title (Today's summary). */
  tight?: boolean;
  id?: string;
  /** For screens that move focus to the title after a change. */
  headingRef?: Ref<HTMLHeadingElement>;
  /** A small control at the end of the title row, after the refresh slot (for example a Streak button). It keeps its size while the title wraps. */
  aside?: ReactNode;
}

/**
 * The top of a tab: its title as the first h2, where focus lands when the tab opens, and a line under it. Inside a
 * `PageLoading` a fixed slot ends the title row and shows the refresh indicator, so the title never moves.
 */
export function PageHeader({ title, count, tight = false, children, id, headingRef, aside }: Props) {
  return (
    <header className={tight ? "mb-3" : "mb-8"}>
      <div className="flex items-start gap-2">
        <h2
          id={id}
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className="my-0 min-w-0 flex-1 text-3xl font-bold leading-tight [overflow-wrap:anywhere]"
        >
          {title}
          {count !== undefined && count > 0 && (
            <span className="ml-2 text-base font-semibold text-muted">{count}</span>
          )}
        </h2>
        <PageFetchingSlot />
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {children && <p className="mt-1 mb-0 font-semibold text-muted first-letter:uppercase">{children}</p>}
    </header>
  );
}

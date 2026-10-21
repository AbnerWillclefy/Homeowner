import type { ReactNode, Ref } from "react";
import { PageFetchingSlot } from "./PageLoading";

interface Props {
  title: ReactNode;
  /** One short line under the title, in muted text. */
  children?: ReactNode;
  id?: string;
  /** For screens that move focus to the title after a change. */
  headingRef?: Ref<HTMLHeadingElement>;
}

/**
 * The top of a tab: its title as the first h2, where focus lands when the tab opens, and a line under it. Inside a
 * `PageLoading` a fixed slot ends the title row and shows the refresh indicator, so the title never moves.
 */
export function PageHeader({ title, children, id, headingRef }: Props) {
  return (
    <header className="mb-8">
      <div className="flex items-start gap-2">
        <h2
          id={id}
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className="my-0 min-w-0 flex-1 text-3xl font-bold leading-tight [overflow-wrap:anywhere]"
        >
          {title}
        </h2>
        <PageFetchingSlot />
      </div>
      {children && <p className="mt-1 mb-0 font-semibold text-muted first-letter:uppercase">{children}</p>}
    </header>
  );
}

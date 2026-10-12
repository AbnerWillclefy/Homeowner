import type { ReactNode, Ref } from "react";

interface Props {
  title: ReactNode;
  /** One short line under the title, in muted text. */
  children?: ReactNode;
  id?: string;
  /** For screens that move focus to the title after a change. */
  headingRef?: Ref<HTMLHeadingElement>;
}

/** The top of a tab: its title as the first h2, where focus lands when the tab opens, and a line under it. */
export function PageHeader({ title, children, id, headingRef }: Props) {
  return (
    <header className="mb-8">
      <h2 id={id} ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="my-0 text-3xl font-bold leading-tight">
        {title}
      </h2>
      {children && <p className="mt-1 mb-0 font-semibold text-muted first-letter:uppercase">{children}</p>}
    </header>
  );
}

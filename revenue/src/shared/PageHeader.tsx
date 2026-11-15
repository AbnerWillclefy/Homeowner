import type { ReactNode } from "react";
import { useMediaQuery } from "./useMediaQuery";

// Duplicates --bp-desktop in Bedrock's tokens.css: matchMedia cannot read custom properties.
const DESKTOP = "(min-width: 1024px)";

/**
 * The top of a screen: its `<h1>` and subtitle on the left, `tools` (month select, hide-values toggle) on the right.
 * Below 1024px it is the phone's top bar: title and tools on one line, never wrapped.
 *
 * Grid convention for the body: `grid gap-6 desktop:grid-cols-12` with `desktop:col-span-{3,4,5,6,7,8,12}` on the cells;
 * below 1024px it is one column. See `revenue/CLAUDE.md`.
 */
export function PageHeader({ title, subtitle, tools }: { title: string; subtitle?: string; tools?: ReactNode }) {
  const desktop = useMediaQuery(DESKTOP);
  return (
    <header className={desktop ? "flex flex-wrap items-center justify-between gap-4" : "flex items-center justify-between gap-2"}>
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="body text-text-muted">{subtitle}</p>}
      </div>
      {tools && <div className="flex shrink-0 items-center gap-2">{tools}</div>}
    </header>
  );
}

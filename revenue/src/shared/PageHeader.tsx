import type { ReactNode } from "react";

/**
 * The top of a screen: its `<h1>` and subtitle on the left, `tools` (month select, hide-values toggle) on the right.
 * When the tools do not fit beside the title (a phone with a month select) they wrap to their own row, so the title
 * keeps the width it needs. Below 1024px a tool button shows only its icon.
 *
 * Grid convention for the body: `grid gap-6 desktop:grid-cols-12` with `desktop:col-span-{3,4,5,6,7,8,12}` on the cells;
 * below 1024px it is one column. See `revenue/CLAUDE.md`.
 */
export function PageHeader({ title, subtitle, tools }: { title: string; subtitle?: string; tools?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 grow basis-48">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="body text-text-muted">{subtitle}</p>}
      </div>
      {tools && <div className="flex flex-wrap items-center gap-2">{tools}</div>}
    </header>
  );
}

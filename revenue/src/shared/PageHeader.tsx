import { Button } from "@homeowner/bedrock";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { HideValuesToggle } from "./HideValues";
import { MonthSelect } from "./month/MonthSelect";

/**
 * The top of a screen: its `<h1>` and subtitle, then the tools in the order of the design's README: the month
 * (`month`), secondary `tools`, the primary `action`, the hide-values eye (`hideValues`). One instance of each control;
 * only CSS moves them, at the Shell's breakpoint (1024px, `desktop:`), so the BottomBar and the phone header go together.
 * - Desktop: one row. The tools wrap to their own row when they do not fit beside the title.
 * - Below 1024px: the title (subtitle on one line, truncated) with the icon buttons at its end, then the month at
 *   full width, 48px tall. The primary action is a round brand "+" whose label is read by screen readers only.
 *
 * Grid convention for the body: `grid gap-6 desktop:grid-cols-12` with `desktop:col-span-{3,4,5,6,7,8,12}` on the cells;
 * below 1024px it is one column. See `revenue/CLAUDE.md`.
 */
export function PageHeader({
  title,
  subtitle,
  month,
  tools,
  action,
  hideValues,
}: {
  title: string;
  subtitle?: string;
  /** Shows the `MonthSelect`. */
  month?: boolean;
  /** Secondary actions, between the month and the primary action. */
  tools?: ReactNode;
  /** The primary action: a `Button` on desktop, a round brand "+" icon button on a phone. */
  action?: { label: string; icon: LucideIcon; onClick: () => void; /** Shows the spinner and disables the button while the action runs. */ loading?: boolean };
  /** Shows the hide-values eye, last. */
  hideValues?: boolean;
}) {
  const icons = tools || action || hideValues;
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 desktop:flex desktop:flex-wrap desktop:items-center desktop:justify-between desktop:gap-x-4">
      <div className="min-w-0 desktop:grow desktop:basis-48">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="body truncate text-text-muted desktop:overflow-visible desktop:whitespace-normal">{subtitle}</p>}
      </div>
      {/* After the title in the DOM, so a keyboard meets the month first on desktop, where it sits first. */}
      {month && (
        <div className="order-last col-span-2 desktop:order-none desktop:col-span-1 desktop:min-w-44">
          <MonthSelect />
        </div>
      )}
      {icons && (
        <div className="col-start-2 row-start-1 flex flex-nowrap items-center gap-2 desktop:flex-wrap">
          {tools}
          {action && (
            <Button icon={action.icon} loading={action.loading} onClick={action.onClick} className="max-desktop:size-control-lg max-desktop:rounded-full max-desktop:px-0">
              <span className="max-desktop:sr-only">{action.label}</span>
            </Button>
          )}
          {hideValues && <HideValuesToggle />}
        </div>
      )}
    </header>
  );
}

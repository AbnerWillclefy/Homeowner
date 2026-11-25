import type { LucideIcon } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { Button } from "./button";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Goes on the `<h1>`, so an app can link to it or focus it. */
  id?: string;
  /** Ref of the `<h1>`, for moving focus to it on navigation (it gets `tabIndex={-1}`). */
  headingRef?: Ref<HTMLHeadingElement>;
  /** The period control (a month). Shown first on desktop; on a phone it is a full-width row under the title. */
  period?: ReactNode | false;
  /** Secondary actions, after the period and before the primary action. */
  tools?: ReactNode;
  /** The primary action: a `Button` on desktop, a round brand icon button on a phone. */
  action?: { label: string; icon: LucideIcon; onClick: () => void; /** Spinner and disabled while the action runs. */ loading?: boolean };
  /** Last in the row, after the primary action (the hide-values eye). */
  trailing?: ReactNode | false;
};

/**
 * The top of a screen: its one `<h1>` and subtitle, then the tools. One instance of each control; only CSS moves
 * them, at the `desktop` breakpoint (1024px): one row on desktop, and below it the title with the icon buttons at
 * its end, then the period at full width.
 */
export function PageHeader({ title, subtitle, id, headingRef, period, tools, action, trailing }: PageHeaderProps) {
  const icons = tools || action || trailing;
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 desktop:flex desktop:flex-wrap desktop:items-center desktop:justify-between desktop:gap-x-4">
      <div className="min-w-0 desktop:grow desktop:basis-48">
        <h1 id={id} ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="page-title">
          {title}
        </h1>
        {subtitle && <p className="body truncate text-text-muted desktop:overflow-visible desktop:whitespace-normal">{subtitle}</p>}
      </div>
      {/* After the title in the DOM, so a keyboard meets the period first on desktop, where it sits first. */}
      {period && <div className="order-last col-span-2 desktop:order-none desktop:col-span-1 desktop:min-w-44">{period}</div>}
      {icons && (
        <div className="col-start-2 row-start-1 flex flex-nowrap items-center gap-2 desktop:flex-wrap">
          {tools}
          {action && (
            <Button icon={action.icon} loading={action.loading} onClick={action.onClick} className="max-desktop:size-control-lg max-desktop:rounded-full max-desktop:px-0">
              <span className="max-desktop:sr-only">{action.label}</span>
            </Button>
          )}
          {trailing}
        </div>
      )}
    </header>
  );
}

export type { PageHeaderProps };

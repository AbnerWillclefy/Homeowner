import { Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";
import { Amount } from "./amount";

type ListRowProps = Omit<ComponentProps<"div">, "title"> & {
  /** A CategoryIcon or a bank logo. */
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  cents: number;
  income?: boolean;
  /** Under the amount: a Badge or a date. */
  end?: ReactNode;
  locale?: string;
  currency?: string;
  /**
   * Makes the single child (an <a>, a router Link or <button type="button">) the row, at least
   * 48px tall; pass it empty, the row fills it. A button holds phrasing content only, so every
   * inner element here is a span, and `leading` and `end` must be phrasing content too.
   */
  asChild?: boolean;
} & ({ hidden?: false; hiddenLabel?: never } | { hidden: true; hiddenLabel: string });

const layout = "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-2 text-left text-text";
const interactive =
  "min-h-control-lg cursor-pointer rounded-md outline-none motion-safe:transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-hover active:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Dividers belong to the list: wrap rows in `<ul className="divide-y divide-border">`. */
export function ListRow({ leading, title, subtitle, cents, income, end, locale, currency, hidden, hiddenLabel, asChild, className, children, ...props }: ListRowProps) {
  const money = { cents, income, locale, currency, size: "sm" } as const;
  const body = (
    <>
      <span className="flex">{leading}</span>
      <span className="flex min-w-0 flex-col">
        <span className="body-strong truncate">{title}</span>
        {subtitle && <span className="caption truncate text-text-muted">{subtitle}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end whitespace-nowrap">
        {hidden ? <Amount {...money} hidden hiddenLabel={hiddenLabel} /> : <Amount {...money} />}
        {end && <span className="caption text-text-muted">{end}</span>}
      </span>
    </>
  );
  if (asChild) {
    return (
      <Slot.Root className={cn(layout, interactive, className)} {...props}>
        <Slot.Slottable>{children}</Slot.Slottable>
        {body}
      </Slot.Root>
    );
  }
  return (
    <div className={cn(layout, className)} {...props}>
      {body}
    </div>
  );
}

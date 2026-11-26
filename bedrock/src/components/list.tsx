import { Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

/** The card that holds Rows (`hm-list`): surface, border, rows split by a border. */
export function List({ className, ...props }: ComponentProps<"ul">) {
  return <ul data-slot="list" className={cn("list-none divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface p-0", className)} {...props} />;
}

type RowProps = Omit<ComponentProps<"li">, "title"> & {
  /** A tile, an Avatar or an icon. A Row with one is 64px tall; without, 56px. */
  leading?: ReactNode;
  title: string;
  caption?: string;
  trailing?: ReactNode;
  /**
   * Makes the single child (an <a>, a router Link or <button type="button">) the row's grid; pass it empty.
   * A button holds phrasing content only, so `leading` and `trailing` must be phrasing content too.
   */
  asChild?: boolean;
};

const interactive =
  "w-full cursor-pointer text-left outline-none motion-safe:transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-hover active:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** One row (`hm-item`) of a List. Only valid inside a `List`: its root is an `<li>`. Title and caption stay on one line. */
export function Row({ leading, title, caption, trailing, asChild, className, children, ...props }: RowProps) {
  const grid = cn(
    "grid items-center gap-4 px-4 py-2 text-text",
    leading ? "min-h-16 grid-cols-[auto_minmax(0,1fr)_auto]" : "min-h-14 grid-cols-[minmax(0,1fr)_auto]",
  );
  const body = (
    <>
      {leading && <span className="flex">{leading}</span>}
      <span className="flex min-w-0 flex-col">
        <span className="body-strong truncate">{title}</span>
        {caption && <span className="caption truncate text-text-muted">{caption}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center">{trailing}</span>}
    </>
  );
  if (!asChild)
    return (
      <li data-slot="row" className={cn(grid, className)} {...props}>
        {body}
      </li>
    );
  // The grid sits on the child, so the whole row is the target; the li only holds it.
  return (
    <li data-slot="row" className={className} {...props}>
      <Slot.Root className={cn(grid, interactive)}>
        <Slot.Slottable>{children}</Slot.Slottable>
        {body}
      </Slot.Root>
    </li>
  );
}

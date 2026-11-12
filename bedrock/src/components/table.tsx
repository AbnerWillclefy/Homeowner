import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/**
 * Plain HTML table (no Radix). `.br-table` marks it; the look is Tailwind utilities on the parts.
 *
 * Clickable rows: never put `onClick` on a `<tr>`, it cannot take focus. Put a real button or link
 * in the row's first cell and stretch it over the row (TableRow is already `relative`): put
 * `after:absolute after:inset-0` on the control. A click anywhere on the row hits the control, and
 * the keyboard reaches it with Tab. Keep other buttons in the row `relative z-10` so they stay above it.
 */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("br-table w-full caption-top border-collapse text-left", className)} {...props} />
    </div>
  );
}

/** A caption says what the table lists. Pass `className="sr-only"` to hide it visually. */
export function TableCaption({ className, ...props }: ComponentProps<"caption">) {
  return <caption className={cn("section-title pb-2 text-left", className)} {...props} />;
}

export function TableHeader(props: ComponentProps<"thead">) {
  return <thead {...props} />;
}

export function TableBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("relative hover:bg-surface-hover [thead_&]:hover:bg-transparent", className)} {...props} />;
}

type Align = { align?: "start" | "end" };
const alignClass = (align?: "start" | "end") => (align === "end" ? "text-right tabular-nums" : "");

// The legacy HTML `align` attribute is typed away so our `align` prop can take its name.
type TableHeadProps = Omit<ComponentProps<"th">, "align"> &
  Align & {
    sort?: "ascending" | "descending" | "none";
    /** Makes the header a button. Without it the header is plain text. */
    onSort?: () => void;
  };

const sortIcon = { ascending: ArrowUp, descending: ArrowDown, none: ArrowUpDown };

export function TableHead({ align, sort, onSort, className, children, ...props }: TableHeadProps) {
  const Icon = sortIcon[sort ?? "none"];
  const sorted = sort === "ascending" || sort === "descending";
  return (
    <th
      scope="col"
      // aria-sort belongs on the columnheader, not on the button.
      aria-sort={onSort ? (sort ?? "none") : undefined}
      className={cn("label border-b border-border px-4 py-2 font-medium", sorted ? "text-text" : "text-text-muted", alignClass(align), className)}
      {...props}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            "touch-target inline-flex items-center gap-1 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            align === "end" && "flex-row-reverse",
          )}
        >
          {children}
          <Icon className="size-4" aria-hidden />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function TableCell({ align, className, ...props }: Omit<ComponentProps<"td">, "align"> & Align) {
  return <td className={cn("body h-control-lg border-b border-border px-4 py-2", alignClass(align), className)} {...props} />;
}

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

type DescriptionListItem = { label: string; value: ReactNode; total?: boolean };

type DescriptionListProps = {
  items: DescriptionListItem[];
  className?: string;
};

/** Takes nodes as values so Finance's Amount slots in without Core importing it. */
export function DescriptionList({ items, className }: DescriptionListProps) {
  // An empty <dl> is invalid, so render nothing.
  if (items.length === 0) return null;
  return (
    <dl className={cn("body m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 tabular-nums", className)}>
      {items.map(({ label, value, total }, index) => (
        // Index key: labels can repeat. The div keeps dt and dd paired and lets the total's border span both columns.
        <div key={index} className={cn("col-span-2 grid grid-cols-subgrid", total && "body-strong border-t border-border pt-2 text-text")}>
          <dt className={cn("truncate", !total && "text-text-muted")}>{label}</dt>
          <dd className="m-0 flex items-center justify-end gap-2 whitespace-nowrap text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type { DescriptionListItem, DescriptionListProps };

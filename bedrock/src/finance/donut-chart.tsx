import { useState, type ReactNode } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer } from "../components/chart";
import { cn } from "../lib/cn";
import { formatAmount } from "./amount";
import { CategoryTag, type SpendingCategoryId } from "./category-tag";

type Slice = { category: SpendingCategoryId; label: string; cents: number };

type DonutChartProps = {
  slices: Slice[];
  /** Name of the merged remainder ("Outros"). */
  otherLabel: string;
  /** The conclusion ("Moradia leva 41% dos gastos"). */
  label: string;
  /** Caption above the total in the centre. */
  totalLabel?: string;
  locale?: string;
  /** A table with the category and the amount, for screen readers. */
  alternative: ReactNode;
  className?: string;
};

const MAX_SLICES = 7;

/** Drops empty slices, sorts descending and, past 7 slices, keeps the top 6; the rest and any input `other` merge into one Other. */
export function groupSlices(slices: Slice[], otherLabel: string): Slice[] {
  const live = slices.filter((s) => s.cents > 0).sort((a, b) => b.cents - a.cents);
  const named = live.filter((s) => s.category !== "other");
  const split = live.length > MAX_SLICES ? MAX_SLICES - 1 : named.length;
  const rest = [...named.slice(split), ...live.filter((s) => s.category === "other")];
  const cents = rest.reduce((n, s) => n + s.cents, 0);
  const out = named.slice(0, split);
  if (cents > 0) out.push({ category: "other", label: otherLabel, cents });
  return out; // Other stays last even when it is larger than a named slice
}

export function DonutChart({ slices, otherLabel, label, totalLabel, locale, alternative, className }: DonutChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const grouped = groupSlices(slices, otherLabel);
  const total = grouped.reduce((n, s) => n + s.cents, 0);
  // Rounded shares may not add up to 100%; that is accepted.
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const empty = total === 0;
  // With nothing spent, one full slice in the track colour keeps the ring.
  const data = empty ? [{ category: "other" as const, label: "", cents: 1 }] : grouped;

  return (
    <div className={cn("flex flex-col items-center gap-4 tablet:flex-row", className)}>
      <div className="relative size-40 shrink-0">
        <ChartContainer label={label} alternative={alternative} className="size-40">
          <PieChart accessibilityLayer={false}>
            <Pie
              data={data}
              dataKey="cents"
              nameKey="label"
              innerRadius={64}
              outerRadius={80}
              startAngle={90}
              endAngle={-270}
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={false}
              onMouseEnter={(_, i) => !empty && setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((s, i) => (
                <Cell
                  key={s.category}
                  fill={empty ? "var(--surface-sunken)" : `var(--cat-${s.category})`}
                  opacity={active === null || active === i ? 1 : 0.4}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        {!empty && (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {totalLabel && <span className="caption text-text-muted">{totalLabel}</span>}
            <span className="label tabular-nums text-text">{formatAmount(total, { locale })}</span>
          </div>
        )}
      </div>
      {!empty && (
        <ul className="flex flex-col gap-1">
          {grouped.map((s, i) => (
            <li
              key={s.category}
              className={cn("rounded-md px-2 py-1", active === i && "bg-surface-hover")}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <CategoryTag category={s.category} label={s.label} share={percent.format(s.cents / total)} size="sm" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type { DonutChartProps };

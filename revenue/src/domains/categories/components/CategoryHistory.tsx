import { ChartContainer } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { Bar, BarChart, Cell, CartesianGrid, XAxis } from "recharts";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { monthLabel, monthShort } from "../../../shared/month/month";
import type { History } from "../api";
import type { SpendingCategory } from "../logic/categories";
import { categoryHistory } from "../logic/history";

/**
 * The months of one category as bars, the chosen month (the last) in brand. One category is not a split, so no category
 * colour. The chart prints no money (no axis, no tooltip), so hiding values needs nothing more; its table of Amounts
 * for screen readers follows the toggle.
 */
export function CategoryHistory({ history, category }: { history: History; category: SpendingCategory }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const { months, allZero } = categoryHistory(history, category);
  if (allZero) return <p className="text-text-muted">{t("categories.history.empty")}</p>;
  const data = months.map(({ month, cents }) => ({ label: monthShort(month, locale), cents: Math.max(cents, 0) }));
  return (
    <ChartContainer
      label={t("categories.history.heading")}
      alternative={
        <table>
          <tbody>
            {months.map(({ month, cents }) => (
              <tr key={month}><th>{monthLabel(month, locale)}</th><td><Amount cents={cents} size="sm" locale={locale} {...hidden} /></td></tr>
            ))}
          </tbody>
        </table>
      }
    >
      <BarChart accessibilityLayer={false} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <Bar dataKey="cents" radius={[4, 4, 4, 4]} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={d.label} fill={i === data.length - 1 ? "var(--brand)" : "var(--chart-bar)"} />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

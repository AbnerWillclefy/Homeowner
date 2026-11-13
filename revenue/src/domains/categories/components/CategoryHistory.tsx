import { ProgressBar } from "@homeowner/bedrock";
import { formatAmount } from "@homeowner/bedrock/finance";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { History } from "../api";
import type { SpendingCategory } from "../logic/categories";
import { categoryHistory } from "../logic/history";
import { monthLabel } from "../logic/month";

/** The months of one category on one scale: a bar and the amount in words for each. One category is not a split, so no category colour. */
export function CategoryHistory({ history, category }: { history: History; category: SpendingCategory }) {
  const { t, locale } = useI18n();
  const { months, allZero } = categoryHistory(history, category);
  if (allZero) return <p className="text-text-muted">{t("categories.history.empty")}</p>;
  const max = Math.max(1, ...months.map((m) => m.cents));
  return (
    <ul className="flex flex-col gap-3" aria-label={t("categories.history.heading")}>
      {months.map(({ month, cents }) => {
        const label = monthLabel(month, locale);
        const amount = formatAmount(cents, { locale });
        return (
          <li key={month}>
            <ProgressBar tone="brand" value={Math.max(cents, 0)} max={max} label={label} valueText={`${label}: ${amount}`} start={label} end={amount} />
          </li>
        );
      })}
    </ul>
  );
}

import { useMemo } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import type { History } from "../api/api";
import type { useHistory } from "../hooks/useHistory";
import { scaleMax } from "../logic/chart";
import { categoryHistory } from "../logic/history";
import { monthLabel, monthName } from "../logic/month";
import type { SpendingCategory } from "../logic/spendingCategories";
import { Bar } from "./charts/Bar";

/** The last six months of one category, on one scale. The data is the single read Gastos made; this only slices it. */
export function CategoryHistory({
  category,
  history,
  marked,
  thisMonth,
}: {
  category: SpendingCategory;
  history: ReturnType<typeof useHistory>;
  /** The month picked in Gastos, the one the chart marks. */
  marked: string;
  /** The device's current month, to word the mark. */
  thisMonth: string;
}) {
  const { t, locale } = useI18n();
  const { state, reload } = history;
  const data: History | null = state.kind === "ready" ? state.data : null;
  const slice = useMemo(() => (data ? categoryHistory(data, category) : null), [data, category]);

  if (state.kind === "failed")
    return (
      <div className="flex flex-col items-start gap-2">
        <p role="alert" className="my-0 text-sm font-semibold">
          {t("finances.history.failed")}
        </p>
        <Button variant="secondary" onClick={() => void reload()}>
          {t("finances.load.retry")}
        </Button>
      </div>
    );
  if (!slice) return null;
  if (slice.allZero) return <p className="my-0 text-sm text-muted">{t("finances.history.empty")}</p>;

  const max = scaleMax(slice.months.map((m) => m.cents), []);
  let year = "";
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm font-semibold text-muted">{t("finances.history.heading")}</p>
      {slice.months.map(({ month, cents }) => {
        const label = month.slice(0, 4) === year ? monthName(month, locale) : monthLabel(month, locale);
        year = month.slice(0, 4);
        return (
          <Bar
            key={month}
            label={label}
            value={cents}
            max={max}
            note={month === marked ? t(marked === thisMonth ? "finances.history.thisMonth" : "finances.history.pickedMonth") : undefined}
          />
        );
      })}
    </div>
  );
}

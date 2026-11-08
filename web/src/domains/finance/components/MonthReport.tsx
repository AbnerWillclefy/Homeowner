import { useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import type { ReportMonth } from "../api/api";
import { useReport } from "../hooks/useReport";
import { barWidth, difference } from "../logic/difference";
import { formatCents } from "../logic/money";
import { addMonths, currentMonth, monthName } from "../logic/month";
import { spendingKey } from "../logic/spendingCategories";
import { MonthPicker } from "./MonthPicker";

/** One bar: decoration only, the value is in the text above it. Zero or negative is a hairline. */
function Bar({ cents, max, hollow }: { cents: number; max: number; hollow?: boolean }) {
  return (
    <div aria-hidden="true" className="h-3">
      <div
        className={`h-full min-w-0.5 rounded-sm border-2 ${hollow ? "border-border bg-surface-raised" : "border-text bg-text"}`}
        style={{ width: `${barWidth(cents, max)}%` }}
      />
    </div>
  );
}

function Chart({ report }: { report: { month: ReportMonth; previous: ReportMonth } }) {
  const { t, locale } = useI18n();
  const name = monthName(report.month.month, locale);
  const previousName = monthName(report.previous.month, locale);
  const previousByCategory = new Map(report.previous.categories.map((c) => [c.category, c.spentCents]));
  const max = Math.max(0, ...report.month.categories.map((c) => c.spentCents), ...previousByCategory.values());
  const diff = difference(report.month.spentCents, report.previous.spentCents);
  const money = (cents: number) => formatCents(cents, locale);

  if (report.month.spentCents === 0 && report.previous.spentCents === 0)
    return <p className="my-0 text-muted">{t("finances.report.empty", { month: name, previous: previousName })}</p>;

  return (
    <>
      <p className="my-0 text-lg font-semibold [overflow-wrap:anywhere]">
        {t(`finances.report.${diff.key}`, { amount: money(diff.amount), month: previousName })}
      </p>
      <p className="my-0 text-sm text-muted [overflow-wrap:anywhere]">
        {t("finances.report.legend", { month: name, previous: previousName })}
      </p>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {report.month.categories.map(({ category, spentCents }) => {
          const previous = previousByCategory.get(category) ?? 0;
          return (
            <li key={category} className="flex flex-col gap-1">
              <span className="font-semibold [overflow-wrap:anywhere]">{t(spendingKey(category))}</span>
              <span className="text-sm [overflow-wrap:anywhere]">{t("finances.report.value", { month: name, amount: money(spentCents) })}</span>
              <Bar cents={spentCents} max={max} />
              <span className="text-sm [overflow-wrap:anywhere]">{t("finances.report.value", { month: previousName, amount: money(previous) })}</span>
              <Bar cents={previous} max={max} hollow />
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** The month's spending by Spending Category against the month before, as text first and bars as decoration. */
export function MonthReport() {
  const { t } = useI18n();
  const [today] = useState(() => currentMonth(new Date()));
  const [month, setMonth] = useState(today);
  const { state, refreshing, reload } = useReport(month);
  const skeleton = useReportFirstLoad(state.kind === "loading");
  useReportFetching(refreshing);

  return (
    <section aria-labelledby="finances-report-heading" className="flex flex-col gap-3">
      <h3 id="finances-report-heading" className="my-0 text-lg font-bold leading-snug [overflow-wrap:anywhere]">
        {t("finances.report.heading")}
      </h3>
      <MonthPicker
        month={month}
        today={today}
        groupLabel={t("finances.report.heading")}
        prevLabel={t("finances.report.prev")}
        nextLabel={t("finances.report.next")}
        onStep={(n) => setMonth(addMonths(month, n))}
      />
      {state.kind === "loading" && skeleton && (
        <div aria-hidden="true">
          <SkeletonBar className="h-5 w-full" />
        </div>
      )}
      {state.kind === "failed" && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="my-0 font-semibold">
            {t("finances.report.failed")}
          </p>
          <Button variant="secondary" onClick={() => void reload()}>
            {t("finances.load.retry")}
          </Button>
        </div>
      )}
      {state.kind === "ready" && <Chart report={state.data} />}
    </section>
  );
}

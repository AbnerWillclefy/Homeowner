import { Button, Card, EmptyState, Skeleton } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { Pencil, Tags } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router";
import { useHideValues, useHiddenProps } from "../../shared/HideValues";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { monthLabel } from "../../shared/month/month";
import { useMonthParam } from "../../shared/month/useMonthParam";
import { PageHeader } from "../../shared/PageHeader";
import { CategoryRows } from "./components/CategoryRows";
import { ChangeBadge } from "./components/ChangeBadge";
import { DailyChart } from "./components/DailyChart";
import { FixedBillsCard } from "./components/FixedBillsCard";
import { LimitsSheet } from "./components/LimitsSheet";
import { UncategorisedCard } from "./components/UncategorisedCard";
import { useHistory, useLimit, useMonthBills, useSpending } from "./hooks/useCategories";
import { changePercent, dayProgress, previousMonth } from "./logic/change";
import { dailySpend, limitPace } from "./logic/daily";
import { categoryRows } from "./logic/rows";
import { uncategorised } from "./logic/uncategorised";

/** "Categorias de gasto" at `/categories`: what each Spending Category took in the month, against its limit (`?month=YYYY-MM`). */
export function CategoriesPage() {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const { hidden: isHidden } = useHideValues();
  const { search } = useLocation();
  const { month, thisMonth, today } = useMonthParam();
  const { data, loading, failed, reload } = useSpending(month);
  // The previous month is one read of two months; a failed read only leaves the change badges out.
  const history = useHistory(month, 2);
  const bills = useMonthBills(month);
  const setLimit = useLimit(month);
  const [editing, setEditing] = useState(false);
  const rows = data ? categoryRows(data) : [];
  const unsorted = data ? uncategorised(data.transactions) : [];
  const previous = previousMonth(history.data, month);
  const total = data ? data.categories.reduce((n, c) => n + c.spentCents, 0) : 0;
  const totalChange = previous && changePercent(total, previous.total);
  const progress = month === thisMonth ? dayProgress(today, month) : null;
  const label = monthLabel(month, locale);
  const monthDays = dayProgress(`${month}-01`, month).days;
  const elapsed = progress ? progress.day : monthDays;
  const daily = data ? dailySpend(data.transactions, elapsed) : [];
  const perDay = Math.round(total / elapsed);

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.categories")}
        subtitle={t("categories.subtitle")}
        month
        hideValues
        tools={
          <>
            {data && (
              <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                <span className="sr-only desktop:not-sr-only">{t("categories.edit")}</span>
              </Button>
            )}
          </>
        }
      />

      {loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("categories.loading")}</span>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : failed || !data ? (
        <EmptyState icon={Tags} kind="no-results" title={t("categories.error.title")} message={t("categories.error.message")} action={{ label: t("categories.error.retry"), onClick: reload }} />
      ) : rows.length === 0 && unsorted.length === 0 ? (
        <EmptyState icon={Tags} title={t("categories.empty.title")} message={t("categories.empty.message")} />
      ) : (
        <div className="grid items-start gap-6 desktop:grid-cols-12">
          <Card className="desktop:col-span-12">
            <span className="label text-text-muted">{t("categories.total.label", { month: label })}</span>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <Amount cents={total} size="lg" locale={locale} {...hidden} />
              {!isHidden && <span className="caption text-text-muted">{t("categories.perDay", { amount: formatAmount(perDay, { locale }) })}</span>}
              {totalChange != null && <ChangeBadge percent={totalChange} />}
            </div>
            {daily.some((d) => d.cents !== 0) ? (
              <DailyChart days={daily} targetCents={limitPace(data.limits, monthDays)} month={label} />
            ) : (
              <p className="text-text-muted">{t("categories.chart.empty")}</p>
            )}
          </Card>
          <Card className="desktop:col-span-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="section-title">{t("categories.byMonth", { month: label })}</h2>
              {progress && <span className="caption text-text-muted">{t("categories.progress", { ...progress, percent: `${progress.percent}%` })}</span>}
            </div>
            <CategoryRows rows={rows} search={search} previous={previous} />
          </Card>
          <div className="flex flex-col gap-6 desktop:col-span-4">
            <UncategorisedCard rows={unsorted} month={month} />
            <FixedBillsCard bills={bills} search={search} />
          </div>
        </div>
      )}
      {editing && data && <LimitsSheet limits={data.limits} save={setLimit} onClose={() => setEditing(false)} />}
    </section>
  );
}

import { Card, EmptyState, Skeleton } from "@homeowner/bedrock";
import { Tags } from "lucide-react";
import { useLocation } from "react-router";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { CategoryRows } from "./components/CategoryRows";
import { MonthNav } from "./components/MonthNav";
import { SpendingDonut } from "./components/SpendingDonut";
import { UncategorisedCard } from "./components/UncategorisedCard";
import { useMonthParam } from "./hooks/useMonthParam";
import { useSpending } from "./hooks/useCategories";
import { categoryRows } from "./logic/rows";
import { uncategorised } from "./logic/uncategorised";

/** "Categorias de gasto" at `/categories`: what each Spending Category took in the month, against its limit (`?month=YYYY-MM`). */
export function CategoriesPage() {
  const { t } = useI18n();
  const { search } = useLocation();
  const { month, thisMonth, step } = useMonthParam();
  const { data, loading, failed, reload } = useSpending(month);
  const rows = data ? categoryRows(data) : [];

  return (
    <section className="flex flex-col gap-6">
      <h1 className="page-title">{t("nav.categories")}</h1>
      <MonthNav month={month} thisMonth={thisMonth} step={step} />

      {loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("categories.loading")}</span>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : failed || !data ? (
        <EmptyState icon={Tags} kind="no-results" title={t("categories.error.title")} message={t("categories.error.message")} action={{ label: t("categories.error.retry"), onClick: reload }} />
      ) : rows.length === 0 && uncategorised(data.transactions).length === 0 ? (
        <EmptyState icon={Tags} title={t("categories.empty.title")} message={t("categories.empty.message")} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 desktop:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Card>
              <h2 className="section-title">{t("categories.donut.heading")}</h2>
              <SpendingDonut rows={rows} />
            </Card>
            <UncategorisedCard rows={uncategorised(data.transactions)} month={month} />
          </div>
          <Card>
            <h2 className="section-title">{t("categories.rows.heading")}</h2>
            <CategoryRows rows={rows} search={search} />
          </Card>
        </div>
      )}
    </section>
  );
}

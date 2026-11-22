import { Button, EmptyState, Skeleton } from "@homeowner/bedrock";
import { LineChart } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useHideValues } from "../../shared/HideValues";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { PageHeader } from "../../shared/PageHeader";
import { useMediaQuery } from "../../shared/useMediaQuery";
import { MonthDetail } from "./components/MonthDetail";
import { MonthsList } from "./components/MonthsList";
import { MonthsTable } from "./components/MonthsTable";
import { PlansInProgress } from "./components/PlansInProgress";
import { ProjectionChart } from "./components/ProjectionChart";
import { useMoney } from "./hooks/useMoney";
import { useProjection } from "./hooks/useProjection";
import { plansInProgress } from "./logic/plansInProgress";
import { projectionRow, type Series, seriesCents } from "./logic/projectionRow";

// Duplicates --bp-desktop in Bedrock's tokens.css: matchMedia cannot read custom properties.
const DESKTOP = "(min-width: 1024px)";

/**
 * "Projeção" at `/projection`: what each of the next twelve months already has to pay and what is left of the Monthly
 * income, then the Installment plans in progress. A chart of the Leftovers (by the plan or at the current pace, one at a
 * time) and the chosen month's sum, then all twelve months: a table on a desktop, a list on a phone. It states a
 * forecast and never commands: a month over the income is a minus sign and "Falta". The chosen month and the series
 * are local state (this month and by plan at first), not `useMonthParam`, which refuses a future month. Monthly income
 * is edited in Settings.
 */
export function ProjectionPage() {
  const { t } = useI18n();
  const desktop = useMediaQuery(DESKTOP);
  const { from, data, loading, failed, reload } = useProjection();
  const { hidden } = useHideValues();
  const money = useMoney();
  const [chosen, setChosen] = useState<string | null>(null);
  const [series, setSeries] = useState<Series>("plan");
  const plans = data ? plansInProgress(data.months) : [];
  const rows = data ? data.months.map(projectionRow) : [];
  const income = data?.monthlyIncomeCents ?? null;
  const selected = rows.find((r) => r.month === (chosen ?? from)) ?? rows[0];

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("nav.projection")} subtitle={income !== null && !hidden ? t("projection.introIncome", { amount: money(income) }) : t("projection.intro")} hideValues />

      {loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("projection.loading")}</span>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : failed || !data || !selected ? (
        <EmptyState icon={LineChart} kind="no-results" title={t("projection.error.title")} message={t("projection.error.message")} action={{ label: t("projection.error.retry"), onClick: reload }} />
      ) : (
        <div className="grid gap-6 desktop:grid-cols-12">
          {income === null ? (
            <div className="flex flex-col items-start gap-3 desktop:col-span-12">
              <p>{t("projection.noIncome")}</p>
              <Button asChild>
                <Link to="/settings">{t("projection.incomeSet")}</Link>
              </Button>
            </div>
          ) : (
            <>
              <ProjectionChart months={rows.map((r) => r.month)} values={rows.map((r) => seriesCents(r, series) ?? 0)} series={series} onSeries={setSeries} selected={selected.month} onSelect={setChosen} desktop={desktop} />
              <MonthDetail row={selected} income={income} series={series} />
            </>
          )}
          {desktop ? (
            <MonthsTable rows={rows} from={from} selected={selected.month} onSelect={setChosen} />
          ) : (
            <MonthsList rows={rows} from={from} series={series} selected={selected.month} onSelect={setChosen} />
          )}
          {plans.length > 0 && <PlansInProgress plans={plans} />}
        </div>
      )}
    </section>
  );
}

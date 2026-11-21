import { Button, EmptyState, Skeleton } from "@homeowner/bedrock";
import { LineChart } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { PageHeader } from "../../shared/PageHeader";
import { useMediaQuery } from "../../shared/useMediaQuery";
import { MonthCard } from "./components/MonthCard";
import { MonthDetail } from "./components/MonthDetail";
import { MonthsTable } from "./components/MonthsTable";
import { PlansInProgress } from "./components/PlansInProgress";
import { ProjectionChart } from "./components/ProjectionChart";
import { useProjection } from "./hooks/useProjection";
import { plansInProgress } from "./logic/plansInProgress";
import { projectionRow } from "./logic/projectionRow";

// Duplicates --bp-desktop in Bedrock's tokens.css: matchMedia cannot read custom properties.
const DESKTOP = "(min-width: 1024px)";

/**
 * "Projeção" at `/projection`: what each of the next twelve months already has to pay and what is left of the Monthly
 * income, then the Installment plans in progress. On a desktop: a chart of the Leftovers, the chosen month's sum and a
 * table of all twelve; on a phone, a card per month. It states a forecast and never commands: a month over the income
 * is a minus sign and words. The chosen month is local state (default this month), not `useMonthParam`, which refuses
 * a future month. Monthly income is edited in Settings.
 */
export function ProjectionPage() {
  const { t } = useI18n();
  const desktop = useMediaQuery(DESKTOP);
  const { from, data, loading, failed, reload } = useProjection();
  const [chosen, setChosen] = useState<string | null>(null);
  const plans = data ? plansInProgress(data.months) : [];
  const rows = data ? data.months.map(projectionRow) : [];
  const income = data?.monthlyIncomeCents ?? null;
  const selected = rows.find((r) => r.month === (chosen ?? from)) ?? rows[0];

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t("nav.projection")} subtitle={t("projection.intro")} hideValues />

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
            desktop && (
              <>
                <ProjectionChart months={rows.map((r) => r.month)} leftovers={rows.map((r) => r.leftoverCents ?? 0)} selected={selected.month} onSelect={setChosen} />
                <MonthDetail row={selected} income={income} />
              </>
            )
          )}
          {desktop ? (
            <MonthsTable rows={rows} from={from} income={income} selected={selected.month} onSelect={setChosen} />
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {data.months.map((m) => <MonthCard key={m.month} data={m} current={m.month === from} income={income} />)}
              </div>
              <p className="caption text-text-muted">{t("projection.footnote")}</p>
            </>
          )}
          {plans.length > 0 && <PlansInProgress plans={plans} />}
        </div>
      )}
    </section>
  );
}

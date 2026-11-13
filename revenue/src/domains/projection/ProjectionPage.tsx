import { Button, EmptyState, Skeleton } from "@homeowner/bedrock";
import { LineChart } from "lucide-react";
import { Link } from "react-router";
import { useI18n } from "../../shared/i18n/I18nProvider";
import { useMediaQuery } from "../../shared/useMediaQuery";
import { MonthCard } from "./components/MonthCard";
import { MonthsTable } from "./components/MonthsTable";
import { PlansInProgress } from "./components/PlansInProgress";
import { useProjection } from "./hooks/useProjection";
import { plansInProgress } from "./logic/plansInProgress";

// Duplicates --bp-desktop in Bedrock's tokens.css: matchMedia cannot read custom properties.
const DESKTOP = "(min-width: 1024px)";

/**
 * "Projeção" at `/projection`: what each of the next twelve months already has to pay and what is left of the Monthly
 * income, then the Installment plans in progress. It states a forecast and never commands: a month over the income is
 * a minus sign and words, with no alarm styling. Monthly income is edited in Settings.
 */
export function ProjectionPage() {
  const { t } = useI18n();
  const desktop = useMediaQuery(DESKTOP);
  const { from, data, loading, failed, reload } = useProjection();
  const plans = data ? plansInProgress(data.months) : [];

  return (
    <section className="flex flex-col gap-6">
      <h1 className="page-title">{t("nav.projection")}</h1>
      <p className="text-text-muted">{t("projection.intro")}</p>

      {loading ? (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">{t("projection.loading")}</span>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : failed || !data ? (
        <EmptyState icon={LineChart} kind="no-results" title={t("projection.error.title")} message={t("projection.error.message")} action={{ label: t("projection.error.retry"), onClick: reload }} />
      ) : (
        <>
          {data.monthlyIncomeCents === null && (
            <div className="flex flex-col items-start gap-3">
              <p>{t("projection.noIncome")}</p>
              <Button asChild>
                <Link to="/settings">{t("projection.incomeSet")}</Link>
              </Button>
            </div>
          )}
          {desktop ? (
            <MonthsTable months={data.months} from={from} income={data.monthlyIncomeCents} />
          ) : (
            <div className="flex flex-col gap-3">
              {data.months.map((m) => <MonthCard key={m.month} data={m} current={m.month === from} income={data.monthlyIncomeCents} />)}
            </div>
          )}
          <p className="caption text-text-muted">{t("projection.footnote")}</p>
          {plans.length > 0 && <PlansInProgress plans={plans} />}
        </>
      )}
    </section>
  );
}

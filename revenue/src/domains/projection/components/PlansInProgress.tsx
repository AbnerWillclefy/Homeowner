import { Card, ProgressBar } from "@homeowner/bedrock";
import { formatAmount } from "@homeowner/bedrock/finance";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { monthLabel } from "../../overview/logic/month";
import type { Plan } from "../logic/plansInProgress";

/** The Installment plans still running, with how far each is and when it ends (possibly past the twelve months shown). */
export function PlansInProgress({ plans }: { plans: Plan[] }) {
  const { t, locale } = useI18n();
  return (
    <section aria-labelledby="projection-plans">
    <Card className="gap-3">
      <h2 id="projection-plans" className="section-title">{t("projection.plans")}</h2>
      <ul className="flex list-none flex-col gap-4 p-0">
        {plans.map((p) => (
          // A line has no plan id, so a plan is its name and total.
          <li key={`${p.name}/${p.total}`} className="flex flex-col gap-1">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="body-strong [overflow-wrap:anywhere]">{p.name}</span>
              <span className="body-strong tabular-nums">{t("projection.planAmount", { amount: formatAmount(p.amountCents, { locale }) })}</span>
            </span>
            <ProgressBar value={p.next - 1} max={p.total} label={p.name} tone="brand" valueText={t("projection.planDone", { n: p.next - 1, m: p.total })} />
            <span className="caption text-text-muted">{t("projection.plan", { n: p.next, m: p.total, month: monthLabel(p.last, locale) })}</span>
          </li>
        ))}
      </ul>
    </Card>
    </section>
  );
}

import { Badge, Card, ProgressBar } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { useHiddenProps, useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Savings } from "../../goals/api";
import { progressPercent } from "../../goals/logic/savings";
import { shortMonthYear } from "../logic/format";
import { CardHead } from "./CardHead";

/** The Emergency reserve (when it has a target) and each Goal, with the Monthly contribution in the heading. */
export function GoalsCard({ savings }: { savings: Savings }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const { hidden: isHidden } = useHideValues();
  const rows = [
    ...(savings.reserve.targetCents !== null
      ? [{ id: "reserve", name: t("goals.reserve.title"), savedCents: savings.reserve.savedCents, targetCents: savings.reserve.targetCents, month: savings.reserve.expectedMonth }]
      : []),
    ...savings.goals.map((g) => ({ id: g.id, name: g.name, savedCents: g.savedCents, targetCents: g.targetCents, month: g.targetMonth })),
  ];
  const label = (
    <>
      {t("nav.goals")}
      {savings.contributionBaseCents !== null && (
        <span className="inline-flex flex-wrap items-baseline gap-x-1">
          {" · "}
          {t("overview.goals.contributionPre")}{" "}
          <Amount cents={savings.contributionBaseCents} size="sm" locale={locale} {...hidden} />{" "}
          {t("overview.goals.contributionPost")}
        </span>
      )}
    </>
  );
  return (
    <Card>
      <CardHead label={label} to="/goals" name={t("nav.goals")} />
      {rows.length === 0 ? (
        <p className="text-text-muted">{t("overview.goals.empty")}</p>
      ) : (
        <ul className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
          {rows.map((r) => {
            const percent = progressPercent(r.savedCents, r.targetCents);
            return (
              <li key={r.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="body-strong [overflow-wrap:anywhere]">{r.name}</span>
                  <Badge tone="positive">{percent}%</Badge>
                </div>
                <ProgressBar
                  tone="brand"
                  value={r.savedCents}
                  max={r.targetCents}
                  label={r.name}
                  valueText={isHidden ? `${percent}%` : `${formatAmount(r.savedCents, { locale })} / ${formatAmount(r.targetCents, { locale })}`}
                  start={<Amount cents={r.savedCents} size="sm" locale={locale} {...hidden} />}
                  end={
                    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1">
                      {t("overview.goals.of")}{" "}
                      <Amount cents={r.targetCents} size="sm" locale={locale} {...hidden} />
                      {r.month && ` · ${shortMonthYear(r.month, locale)}`}
                    </span>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

import { Badge, Card, CardHeader, CardLabel } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { monthLabel } from "../../../shared/month/month";
import { CategoryCuts } from "./CategoryCuts";
import { useMoney } from "../hooks/useMoney";
import type { ProjectionRow } from "../logic/projectionRow";

/** The chosen month's sum, line by line: the Monthly income less each group is its Leftover. A short month says how much, in words. */
export function MonthDetail({ row, income }: { row: ProjectionRow; income: number }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const money = useMoney();
  const leftover = row.leftoverCents ?? 0;
  const lines = [
    ["overview.group.cards", row.cardsCents], ["overview.group.bills", row.billsCents], ["overview.group.planned", row.plannedCents],
    ["overview.group.spent", row.spentCents], ["overview.group.saving", row.savingCents],
  ] as const;

  return (
    <Card className="min-w-0 desktop:col-span-4">
      <CardHeader>
        <CardLabel>{monthLabel(row.month, locale)}</CardLabel>
        <Badge tone={leftover < 0 ? "danger" : "positive"}>{leftover < 0 ? t("projection.short", { amount: money(-leftover) }) : t("projection.leftoverPlan")}</Badge>
      </CardHeader>
      <Amount cents={leftover} size="lg" locale={locale} {...hidden} />
      <dl className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <dt>{t("overview.leftover.income")}</dt>
          <dd><Amount cents={income} size="sm" locale={locale} {...hidden} /></dd>
        </div>
        {lines.map(([key, cents]) => cents !== undefined && (
          <div key={key} className="flex items-baseline justify-between gap-3 text-text-muted">
            <dt>− {t(key)}</dt>
            <dd><Amount cents={cents} size="sm" locale={locale} {...hidden} /></dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
          <dt className="body-strong">{t("projection.leftoverPlan")}</dt>
          <dd><Amount cents={leftover} size="sm" locale={locale} {...hidden} /></dd>
        </div>
        {row.paceLeftoverCents !== null && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="body-strong">{t("projection.paceLeftover")}</dt>
            <dd><Amount cents={row.paceLeftoverCents} size="sm" locale={locale} {...hidden} /></dd>
          </div>
        )}
      </dl>
      <CategoryCuts cuts={row.cuts} />
    </Card>
  );
}

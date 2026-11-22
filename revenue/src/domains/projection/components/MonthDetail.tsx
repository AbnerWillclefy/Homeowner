import { Badge, Card, CardHeader, CardLabel, DescriptionList, type DescriptionListItem } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { monthLabel } from "../../../shared/month/month";
import { type ProjectionRow, type Series, seriesCents } from "../logic/projectionRow";

/**
 * The chosen month's sum, line by line: the Monthly income less each group is its Leftover by the plan, and that less
 * the pace gap is the Leftover at the current pace. The shown series is the big figure; a short month says "Falta" in
 * words. "Gasto fora do cartão" is a line only when the month has it (the current one). The pace gap is one signed
 * line, the difference of the two Leftovers, because the API sums every planned line's gap, over or under, so the
 * lines always add up.
 */
export function MonthDetail({ row, income, series }: { row: ProjectionRow; income: number; series: Series }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const shown = seriesCents(row, series) ?? 0;
  const amount = (cents: number) => <Amount cents={cents} size="sm" locale={locale} {...hidden} />;
  const minus = (key: Parameters<typeof t>[0], cents: number | undefined): DescriptionListItem[] => (cents === undefined ? [] : [{ label: `− ${t(key)}`, value: amount(cents) }]);
  const paceGap = (gap: number): DescriptionListItem => ({ label: `${gap < 0 ? "+" : "−"} ${t("projection.paceGap")}`, value: amount(Math.abs(gap)) });
  const items: DescriptionListItem[] = [
    { label: t("overview.leftover.income"), value: amount(income) },
    ...minus("overview.group.cards", row.cardsCents),
    ...minus("overview.group.bills", row.billsCents),
    ...minus("overview.group.planned", row.plannedCents),
    ...minus("overview.group.spent", row.spentCents),
    ...minus("overview.group.saving", row.savingCents),
    { label: t("projection.leftoverPlan"), value: amount(row.leftoverCents ?? 0), total: true },
    ...(row.paceLeftoverCents === null || row.leftoverCents === null ? [] : [paceGap(row.leftoverCents - row.paceLeftoverCents)]),
    ...(row.paceLeftoverCents === null ? [] : [{ label: t("projection.paceLeftover"), value: amount(row.paceLeftoverCents), total: true }]),
  ];

  return (
    <Card variant="compact" role="region" aria-labelledby="projection-month" className="min-w-0 desktop:col-span-4 desktop:p-6">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardLabel id="projection-month">{monthLabel(row.month, locale)}</CardLabel>
        {shown < 0 && <Badge tone="danger">{t("plan.projection.badge")}</Badge>}
      </CardHeader>
      <div className="flex flex-col gap-1">
        <Amount cents={shown} size="lg" locale={locale} {...hidden} />
        <span className="body text-text-muted">{series === "pace" ? t("projection.paceLeftover") : t("projection.leftoverPlan")}</span>
      </div>
      <DescriptionList items={items} />
    </Card>
  );
}

import { Card } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { CommitmentMonth } from "../api/api";
import type { MessageKey } from "../../../shared/i18n/catalogs";
import { monthName } from "../logic/month";
import { monthRows } from "../logic/monthRows";

const GROUP: Record<string, MessageKey> = {
  cards: "overview.group.cards", bills: "overview.group.bills", planned: "overview.group.planned", spent: "overview.group.spent", saving: "overview.group.saving",
};

/**
 * The month's Leftover with today's values, the API's one with the planned spending (each Category's limit, or its average) when it
 * differs, and what makes up the Total. Neutral: a total above the income is one muted sentence, never a danger colour.
 */
export function Leftover({ data, income }: { data: CommitmentMonth; income: number | null }) {
  const { t, locale } = useI18n();
  const rows = monthRows(data);
  const money = (cents: number) => formatAmount(cents, { locale });
  return (
    <Card>
      <h2 className="section-title">{rows.leftoverCents === null ? monthName(data.month, locale) : t("overview.leftover.heading", { month: monthName(data.month, locale) })}</h2>
      {rows.leftoverCents !== null && rows.todayLeftoverCents !== null && (
        <>
          <Amount cents={rows.todayLeftoverCents} size="lg" locale={locale} />
          <p className="text-text-muted">
            {rows.todayLeftoverCents < 0
              ? t("overview.leftover.over", { amount: money(-rows.todayLeftoverCents) })
              : t("overview.leftover.sentence", { amount: money(rows.todayLeftoverCents) })}
          </p>
          {data.plannedCents > 0 && (
            <p className="text-text-muted">
              {rows.overCents > 0
                ? t("overview.leftover.averageOver", { amount: money(rows.overCents) })
                : t("overview.leftover.average", { amount: money(rows.leftoverCents) })}
            </p>
          )}
        </>
      )}
      <dl className="flex flex-col gap-2 border-t border-border pt-3">
        {rows.groups.map((g) => (
          <div key={g.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
            <dt className="min-w-0 [overflow-wrap:anywhere]">{t(GROUP[g.id]!)}</dt>
            <dd className="body-strong tabular-nums">{money(g.cents)}</dd>
          </div>
        ))}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-border pt-2">
          <dt className="body-strong">{t("overview.leftover.total")}</dt>
          <dd className="body-strong tabular-nums">{money(rows.totalCents)}</dd>
        </div>
        {income !== null && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-text-muted">
            <dt>{t("overview.leftover.income")}</dt>
            <dd className="tabular-nums">{money(income)}</dd>
          </div>
        )}
      </dl>
    </Card>
  );
}

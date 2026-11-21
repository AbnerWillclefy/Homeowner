import { Badge, Card, CardLabel } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Totals } from "../logic/totals";

/** The month's totals (never the filtered rows'). "Sem categoria" has a badge that filters the list to those Expenses. */
export function TotalsRow({ totals, reviewing, onReview }: { totals: Totals; reviewing: boolean; onReview(): void }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  return (
    <section aria-label={t("tx.totals.label")} className="grid gap-6 desktop:col-span-12 desktop:grid-cols-12">
      <Card variant="compact" className="desktop:col-span-4">
        <CardLabel>{t("tx.total.spent")}</CardLabel>
        <Amount cents={totals.spentCents} size="md" locale={locale} {...hidden} />
      </Card>
      <Card variant="compact" className="desktop:col-span-4">
        <CardLabel>{t("tx.total.income")}</CardLabel>
        <Amount cents={totals.incomeCents} size="md" income locale={locale} {...hidden} />
      </Card>
      <Card variant="compact" className="desktop:col-span-4">
        <CardLabel>{t("tx.total.uncategorised")}</CardLabel>
        <div className="flex items-center gap-2">
          <span className="value-md tabular-nums">{totals.uncategorised}</span>
          {totals.uncategorised > 0 && (
            <button
              type="button"
              aria-pressed={reviewing}
              onClick={onReview}
              className="touch-target rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Badge tone="warning">{t("tx.review")}</Badge>
            </button>
          )}
        </div>
      </Card>
    </section>
  );
}

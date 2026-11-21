import { Card, CardLabel, ProgressBar } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { useHiddenProps, useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { BillSummary as Summary } from "../logic/billState";

/** "Falta pagar em <mês>": what is left, and paid against the total as a bar. */
export function BillSummary({ paidCents, toPayCents, toPayCount, month }: Summary & { month: string }) {
  const { t, locale } = useI18n();
  const hiddenProps = useHiddenProps();
  const { hidden } = useHideValues();
  const money = (cents: number) => formatAmount(cents, { locale });
  const total = paidCents + toPayCents;
  // A string cannot read the toggle, so a hidden one carries no money.
  const paidText = hidden ? t("hide.label") : t("bills.left.paidOf", { paid: money(paidCents) });
  const ofText = hidden ? "" : t("bills.left.of", { total: money(total) });
  return (
    <Card>
      <CardLabel>{t("bills.left.label", { month })}</CardLabel>
      <Amount cents={toPayCents} size="lg" locale={locale} {...hiddenProps} />
      <ProgressBar
        value={paidCents}
        max={Math.max(total, 1)}
        tone="brand"
        label={t("bills.left.progress")}
        valueText={`${paidText} ${ofText}`.trim()}
        start={paidText}
        end={ofText || undefined}
      />
      <p className="caption text-text-muted">
        {toPayCount > 0 ? `${t(toPayCount === 1 ? "bills.summary.leftOne" : "bills.summary.leftMany", { count: toPayCount })}. ` : `${t("bills.summary.allPaid")}. `}
        {t("bills.left.note")}
      </p>
    </Card>
  );
}

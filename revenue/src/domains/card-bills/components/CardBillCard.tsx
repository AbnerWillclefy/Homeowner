import { Badge, Card, CardLabel, DescriptionList, ProgressBar } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { useHiddenProps, useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { formatDay } from "../../../shared/month/month";
import type { CardBill, CardSource, CardTransaction } from "../api";
import { billSplit } from "../logic/cardBill";

interface Props {
  bill: CardBill;
  /** The card's Source, for its limit; absent while the status is not read. */
  source: CardSource | undefined;
  /** This card's rows that count in the bill, null while they could not be read. */
  rows: CardTransaction[] | null;
}

/**
 * One card's bill: the bank's total or the app's sum of the card's charges plus the known installments, closed or
 * open; the label says which state and the line under the amount which source, so the number is never bare.
 */
export function CardBillCard({ bill, source, rows }: Props) {
  const { t, locale } = useI18n();
  const hiddenProps = useHiddenProps();
  const { hidden } = useHideValues();
  const closed = bill.fromBank || bill.closed;
  const split = rows && billSplit(rows);
  const limit = source?.creditLimitCents ?? null;
  const money = (cents: number) => formatAmount(cents, { locale });
  const limitText = hidden ? t("hide.label") : t("cardBills.limit.of", { used: money(bill.amountCents), limit: money(limit ?? 0) });
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <CardLabel className="min-w-0 [overflow-wrap:anywhere]">{t(closed ? "cardBills.label.closed" : "cardBills.label.open", { name: bill.name })}</CardLabel>
        {bill.closesOn && <Badge tone="neutral">{t("cardBills.closesOn", { date: formatDay(bill.closesOn, locale) })}</Badge>}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4">
        <Amount cents={bill.amountCents} size="hero" locale={locale} {...hiddenProps} />
        {bill.dueOn && <span className="text-text-muted">{t("cardBills.dueOn", { date: formatDay(bill.dueOn, locale) })}</span>}
      </div>
      <p className="caption text-text-muted">{t(bill.fromBank ? "cardBills.source.bank" : "cardBills.source.app")}</p>
      {!bill.billDaysKnown && <p className="caption text-text-muted">{t("cardBills.noDays")}</p>}
      {split && (
        <>
          <DescriptionList
            items={(["purchases", "installments", "subscriptions"] as const).map((key) => ({
              label: t(`cardBills.split.${key}`),
              value: <Amount cents={split[`${key}Cents`]} size="sm" locale={locale} {...hiddenProps} />,
            }))}
          />
          <p className="caption text-text-muted">{t("cardBills.split.note")}</p>
        </>
      )}
      {limit !== null && limit > 0 && (
        <ProgressBar
          value={Math.max(bill.amountCents, 0)}
          max={limit}
          label={t("cardBills.limit.label")}
          valueText={limitText}
          start={t("cardBills.limit.label")}
          end={limitText}
        />
      )}
    </Card>
  );
}

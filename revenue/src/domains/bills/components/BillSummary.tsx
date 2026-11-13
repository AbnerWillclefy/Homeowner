import { ProgressBar } from "@homeowner/bedrock";
import { formatAmount } from "@homeowner/bedrock/finance";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { BillSummary as Summary } from "../logic/billState";

/** Paid against still to pay, as a sentence and a bar. */
export function BillSummary({ paidCents, toPayCents, toPayCount }: Summary) {
  const { t, locale } = useI18n();
  const money = (cents: number) => formatAmount(cents, { locale });
  const total = paidCents + toPayCents;
  const text = t("bills.summary.paidOf", { paid: money(paidCents), total: money(total) });
  return (
    <div className="flex flex-col gap-2">
      <ProgressBar
        value={paidCents}
        max={Math.max(total, 1)}
        label={t("bills.summary.label")}
        valueText={text}
        start={text}
        end={toPayCount > 0 ? t(toPayCount === 1 ? "bills.summary.leftOne" : "bills.summary.leftMany", { count: toPayCount, amount: money(toPayCents) }) : t("bills.summary.allPaid")}
      />
    </div>
  );
}

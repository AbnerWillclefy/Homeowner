import { useI18n } from "../../../shared/i18n";
import { formatCents } from "../logic/money";
import { SplitBar } from "./charts/SplitBar";

/** Paid against still to pay: both as text, and as a bar (paid solid, still to pay hatched). The amounts come from the groups below. */
export function BillSummary({ paidCents, toPayCents }: { paidCents: number; toPayCents: number }) {
  const { t, locale } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <p className="my-0 flex flex-wrap justify-between gap-x-3 text-lg font-bold">
        <span>{t("finances.bills.summary.paid", { amount: formatCents(paidCents, locale) })}</span>
        <span>{t("finances.bills.summary.toPay", { amount: formatCents(toPayCents, locale) })}</span>
      </p>
      <SplitBar solid={paidCents} hatched={toPayCents} max={paidCents + toPayCents} />
    </div>
  );
}

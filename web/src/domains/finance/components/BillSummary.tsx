import { useI18n } from "../../../shared/i18n";
import { formatCents } from "../logic/money";
import { SplitBar } from "./charts/SplitBar";

// Stands in for an amount in a translated sentence, so it can be set in bold where the locale puts it.
const MARK = "\u0000";

/** Paid against still to pay, in one sentence and as a bar (paid solid, still to pay hatched). The amounts come from the groups. */
export function BillSummary({ paidCents, toPayCents, toPayCount }: { paidCents: number; toPayCents: number; toPayCount: number }) {
  const { t, locale } = useI18n();
  const money = (cents: number) => formatCents(cents, locale);
  const [paidPart, totalPart, ...rest] = t("finances.bills.summary.paidOf", { paid: MARK, total: MARK }).split(MARK);
  const [leftBefore, leftAfter] = t("finances.bills.summary.left", { count: toPayCount, amount: MARK }).split(MARK);
  return (
    <div className="flex flex-col gap-3">
      <p className="my-0">
        {paidPart}
        <strong>{money(paidCents)}</strong>
        {totalPart}
        <strong>{money(paidCents + toPayCents)}</strong>
        {rest.join("")}
        {toPayCount > 0 && (
          <>
            {" "}
            {leftBefore}
            <strong>{money(toPayCents)}</strong>
            {leftAfter}
          </>
        )}
      </p>
      <SplitBar solid={paidCents} hatched={toPayCents} max={paidCents + toPayCents} />
    </div>
  );
}

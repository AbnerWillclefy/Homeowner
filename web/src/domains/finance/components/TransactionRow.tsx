import { useI18n } from "../../../shared/i18n";
import type { Transaction } from "../api/api";
import { formatCents } from "../logic/money";
import { formatDay } from "../logic/month";
import { spent } from "../logic/monthView";

/**
 * One Transaction as a button that opens its edit dialog: the description and where it came from, the amount at the
 * end. The description wraps in full. A refund shows a minus sign and says "estorno" / "refund", so it is not told by
 * the sign alone. `showDate` is off under a day heading.
 */
export function TransactionRow({ tx, onEdit, showDate = true }: { tx: Transaction; onEdit(tx: Transaction): void; showDate?: boolean }) {
  const { t, locale } = useI18n();
  const shown = tx.type === "expense" ? spent(tx) : tx.amountCents;
  const refund = tx.type === "expense" && shown < 0;
  return (
    <li className="m-0 list-none border-t border-chart-track first:border-t-0">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => onEdit(tx)}
        className="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-transparent px-0 py-2 text-start font-[inherit] text-inherit"
      >
        <span className="flex min-w-0 flex-1 basis-40 flex-col">
          <span className="font-semibold [overflow-wrap:anywhere]">{tx.description}</span>
          <span className="text-sm text-muted [overflow-wrap:anywhere]">
            {showDate ? `${formatDay(tx.postedOn, locale)} · ${tx.sourceName}` : tx.sourceName}
          </span>
        </span>
        <span className="font-bold">
          {formatCents(shown, locale)}
          {refund && <span className="font-normal text-muted"> · {t("finances.month.refund")}</span>}
        </span>
      </button>
    </li>
  );
}

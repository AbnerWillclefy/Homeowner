import { useI18n } from "../../../shared/i18n";
import type { Transaction } from "../api/api";
import { formatCents } from "../logic/money";
import { formatDay } from "../logic/month";
import { spent } from "../logic/monthView";

/**
 * One Transaction as a button that opens its edit dialog. The description wraps in full. A refund shows a minus
 * sign and says "estorno" / "refund", so it is not told by the sign alone.
 */
export function TransactionRow({ tx, onEdit }: { tx: Transaction; onEdit(tx: Transaction): void }) {
  const { t, locale } = useI18n();
  const shown = tx.type === "expense" ? spent(tx) : tx.amountCents;
  const refund = tx.type === "expense" && shown < 0;
  return (
    <li className="m-0 list-none border-t border-border first:border-t-0">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => onEdit(tx)}
        className="flex min-h-11 w-full flex-col gap-1 rounded-control bg-transparent px-0 py-2 text-start font-[inherit] text-inherit"
      >
        <span className="font-semibold [overflow-wrap:anywhere]">{tx.description}</span>
        <span className="text-sm text-muted [overflow-wrap:anywhere]">
          {formatDay(tx.postedOn, locale)} · {tx.sourceName}
        </span>
        <span className="font-semibold">
          {formatCents(shown, locale)}
          {refund && <span className="font-normal text-muted"> · {t("finances.month.refund")}</span>}
        </span>
      </button>
    </li>
  );
}

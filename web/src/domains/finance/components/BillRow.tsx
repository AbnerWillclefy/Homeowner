import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import type { Bill } from "../api/api";
import { BILL_STATE_KEY, billState } from "../logic/billState";
import { formatCents } from "../logic/money";
import { formatDay } from "../logic/month";
import { BillMenu } from "./BillMenu";

interface Props {
  bill: Bill;
  /** `YYYY-MM-DD`; null for a past month, where no Bill is overdue. */
  today: string | null;
  /** A past month: no Paid, Undo or menu. */
  readOnly: boolean;
  /** A write on this Bill is running. */
  busy: boolean;
  onPaid(paid: boolean): void;
  onEdit(opener: HTMLElement | null): void;
  onDelete(opener: HTMLElement | null): void;
}

/**
 * One Bill as a compact row: name, amount and date on the left; Paid / Undo and the "⋯" menu on the right. The group
 * heading tells overdue from to pay, and the date line says it in words too, never by colour. A Bill paid by the bank has no Undo.
 */
export function BillRow({ bill, today, readOnly, busy, onPaid, onEdit, onDelete }: Props) {
  const { t, locale } = useI18n();
  const state = billState(bill, today);
  const date = formatDay(bill.dueDate, locale);
  const line =
    state === "overdue"
      ? t("finances.bills.state.overdue", { date })
      : state === "due"
        ? t(readOnly ? "finances.bills.dueOn" : "finances.bills.due", { date })
        : t(BILL_STATE_KEY[state]);
  // Both amounts when they differ, said plainly: no colour or icon judges the difference.
  const amount =
    bill.paid && bill.paidCents !== null && bill.paidCents !== bill.expectedCents
      ? t("finances.bills.expectedPaid", { expected: formatCents(bill.expectedCents, locale), paid: formatCents(bill.paidCents, locale) })
      : formatCents(bill.expectedCents, locale);
  return (
    // At the largest text the actions wrap under the name instead of squeezing it to nothing.
    <li className="m-0 flex list-none flex-wrap items-start justify-between gap-2 py-2">
      <div className="min-w-32 flex-1">
        <p className="my-0 font-semibold [overflow-wrap:anywhere]">{bill.name}</p>
        <p className="my-0 [overflow-wrap:anywhere]">{amount}</p>
        <p className="my-0 text-sm text-muted [overflow-wrap:anywhere]">{line}</p>
      </div>
      {!readOnly && (
        <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
          {state === "paid-bank" ? null : state === "paid-hand" ? (
            <Button variant="secondary" pending={busy} aria-label={t("finances.bills.undo.label", { name: bill.name })} onClick={() => onPaid(false)}>
              {t("finances.bills.undo")}
            </Button>
          ) : (
            <Button pending={busy} aria-label={t("finances.bills.markPaid.label", { name: bill.name })} onClick={() => onPaid(true)}>
              {t("finances.bills.markPaid")}
            </Button>
          )}
          <BillMenu name={bill.name} disabled={busy} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </li>
  );
}

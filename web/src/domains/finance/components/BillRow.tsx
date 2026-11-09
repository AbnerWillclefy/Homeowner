import { CalendarDays, Check, CircleCheck, Clock, Landmark } from "lucide-react";
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

const ICON = { overdue: CalendarDays, due: Clock, "paid-bank": Landmark, "paid-hand": CircleCheck } as const;

/**
 * One Bill as a compact row: name, amount and a date line with an icon on the left; the "⋯" menu and Paid / Undo on
 * the right. An overdue Bill's Paid is the filled button. The group heading tells overdue from to pay, and the date
 * line says it in words too, never by colour. A Bill paid by the bank has no Undo.
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
  const Icon = ICON[state];
  return (
    // At the largest text the actions wrap under the name instead of squeezing it to nothing.
    <li className="m-0 flex list-none flex-wrap items-center justify-between gap-2 border-t border-chart-track py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 basis-32">
        <p className="my-0 font-bold [overflow-wrap:anywhere]">{bill.name}</p>
        <p className="my-0 font-bold [overflow-wrap:anywhere]">{amount}</p>
        <p className="my-0 flex items-start gap-1.5 text-sm text-muted [overflow-wrap:anywhere]">
          <Icon aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          {line}
        </p>
      </div>
      {!readOnly && (
        <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
          <BillMenu name={bill.name} disabled={busy} onEdit={onEdit} onDelete={onDelete} />
          {state === "paid-bank" ? null : state === "paid-hand" ? (
            <Button variant="secondary" pending={busy} aria-label={t("finances.bills.undo.label", { name: bill.name })} onClick={() => onPaid(false)}>
              {t("finances.bills.undo")}
            </Button>
          ) : (
            <Button
              variant={state === "overdue" ? "primary" : "secondary"}
              pending={busy}
              leadingIcon={<Check aria-hidden="true" size={16} />}
              aria-label={t("finances.bills.markPaid.label", { name: bill.name })}
              onClick={() => onPaid(true)}
            >
              {t("finances.bills.markPaid")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

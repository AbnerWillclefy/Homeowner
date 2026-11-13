import { Button, Menu, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { Check, Pencil, Trash2, Undo2 } from "lucide-react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Bill } from "../api";
import { billState, type BillState } from "../logic/billState";
import { formatDay } from "../logic/month";
import { BillStatus } from "./BillStatus";

interface RowsProps {
  rows: Bill[];
  caption: string;
  /** `YYYY-MM-DD` in São Paulo; null for a past month, which is read-only. */
  today: string | null;
  /** Id of the Bill whose paid mark is being written; its button waits. */
  busy: ReadonlySet<string>;
  onPaid(bill: Bill, paid: boolean): void;
  onEdit(bill: Bill): void;
  onDelete(bill: Bill): void;
}

/** Both amounts when what was paid differs from what was expected, said plainly. */
function useNote() {
  const { t, locale } = useI18n();
  return (bill: Bill, state: BillState) => {
    if (state === "overdue") return t("bills.overdueOn", { date: formatDay(bill.dueDate, locale) });
    if (bill.paid && bill.paidCents !== null && bill.paidCents !== bill.expectedCents) {
      return t("bills.expectedPaid", { expected: formatAmount(bill.expectedCents, { locale }), paid: formatAmount(bill.paidCents, { locale }) });
    }
    if (state === "paid-bank") return t("bills.paidByBank");
    return "";
  };
}

/** Mark paid or Undo, and the menu with Edit and Delete. A Bill paid by the bank has no Undo; a past month has no actions. */
function Actions({ bill, state, today, busy, onPaid, onEdit, onDelete }: Omit<RowsProps, "rows" | "caption"> & { bill: Bill; state: BillState }) {
  const { t } = useI18n();
  if (today === null) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {state === "paid-hand" ? (
        <Button variant="secondary" size="sm" icon={Undo2} loading={busy.has(bill.id)} onClick={() => onPaid(bill, false)}>
          {t("bills.undo")}<span className="sr-only">: {bill.name}</span>
        </Button>
      ) : state === "paid-bank" ? null : (
        <Button variant={state === "overdue" ? "primary" : "secondary"} size="sm" icon={Check} loading={busy.has(bill.id)} onClick={() => onPaid(bill, true)}>
          {t("bills.markPaid")}<span className="sr-only">: {bill.name}</span>
        </Button>
      )}
      <Menu
        label={t("bills.menu", { name: bill.name })}
        closeLabel={t("app.close")}
        items={[
          { label: t("bills.edit"), icon: Pencil, onSelect: () => onEdit(bill) },
          { label: t("bills.delete"), icon: Trash2, danger: true, onSelect: () => onDelete(bill) },
        ]}
      />
    </div>
  );
}

/** Desktop width: a table by due date. */
export function BillsTable({ rows, caption, today, ...actions }: RowsProps) {
  const { t, locale } = useI18n();
  const note = useNote();
  return (
    <Table>
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t("bills.col.due")}</TableHead>
          <TableHead>{t("bills.col.name")}</TableHead>
          <TableHead>{t("bills.col.status")}</TableHead>
          <TableHead align="end">{t("bills.col.amount")}</TableHead>
          {today !== null && <TableHead align="end">{t("bills.col.actions")}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((bill) => {
          const state = billState(bill, today);
          return (
            <TableRow key={bill.id}>
              <TableCell className="whitespace-nowrap text-text-muted">{formatDay(bill.dueDate, locale)}</TableCell>
              <TableCell>
                <span className="body-strong [overflow-wrap:anywhere]">{bill.name}</span>
                {note(bill, state) && <p className="caption text-text-muted [overflow-wrap:anywhere]">{note(bill, state)}</p>}
              </TableCell>
              <TableCell>
                <BillStatus state={state} />
              </TableCell>
              <TableCell align="end">
                <Amount cents={bill.expectedCents} size="sm" locale={locale} />
              </TableCell>
              {today !== null && (
                <TableCell align="end">
                  <Actions bill={bill} state={state} today={today} {...actions} />
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** Phone width: a list. The actions wrap under the name at the largest text instead of squeezing it. */
export function BillsList({ rows, caption, today, ...actions }: RowsProps) {
  const { t, locale } = useI18n();
  const note = useNote();
  return (
    <ul aria-label={caption} className="divide-y divide-border">
      {rows.map((bill) => {
        const state = billState(bill, today);
        const detail = [t("bills.dueOn", { date: formatDay(bill.dueDate, locale) }), note(bill, state)].filter(Boolean).join(" · ");
        return (
          <li key={bill.id} className="flex flex-col gap-2 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="body-strong [overflow-wrap:anywhere]">{bill.name}</span>
                <span className="caption text-text-muted [overflow-wrap:anywhere]">{detail}</span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Amount cents={bill.expectedCents} size="sm" locale={locale} />
                <BillStatus state={state} />
              </div>
            </div>
            <Actions bill={bill} state={state} today={today} {...actions} />
          </li>
        );
      })}
    </ul>
  );
}

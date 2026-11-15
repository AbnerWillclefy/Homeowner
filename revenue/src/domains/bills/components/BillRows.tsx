import { Badge, Button, Menu } from "@homeowner/bedrock";
import { Amount, CategoryIcon, formatAmount, ListRow } from "@homeowner/bedrock/finance";
import { Check, Pencil, Trash2, Undo2 } from "lucide-react";
import { useHiddenProps, useHideValues } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { formatDay } from "../../../shared/month/month";
import type { Bill } from "../api";
import { billState, type BillState } from "../logic/billState";
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

/** Both amounts when what was paid differs from what was expected, said plainly (left out while values are hidden: it is a string). */
function useNote() {
  const { t, locale } = useI18n();
  const { hidden } = useHideValues();
  return (bill: Bill, state: BillState) => {
    if (state === "overdue") return t("bills.overdueOn", { date: formatDay(bill.dueDate, locale) });
    if (!hidden && bill.paid && bill.paidCents !== null && bill.paidCents !== bill.expectedCents) {
      return t("bills.expectedPaid", { expected: formatAmount(bill.expectedCents, { locale }), paid: formatAmount(bill.paidCents, { locale }) });
    }
    if (state === "paid-bank") return t("bills.paidByBank");
    return "";
  };
}

/** Mark paid or Undo, and the menu with Edit and Delete. A Bill paid by the bank has no Undo; a past month has no actions. */
function Actions({ bill, state, busy, onPaid, onEdit, onDelete }: Pick<RowsProps, "busy" | "onPaid" | "onEdit" | "onDelete"> & { bill: Bill; state: BillState }) {
  const { t } = useI18n();
  return (
    <div className="ml-auto flex items-center gap-1">
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

/** One row per Bill, by due date. The actions wrap under the row at the largest text instead of squeezing it. */
export function BillRows({ rows, caption, today, ...actions }: RowsProps) {
  const { locale, t } = useI18n();
  const hidden = useHiddenProps();
  const note = useNote();
  return (
    <ul aria-label={caption} className="divide-y divide-border">
      {rows.map((bill) => {
        const state = billState(bill, today);
        const subtitle = [t("bills.dueOn", { date: formatDay(bill.dueDate, locale) }), note(bill, state)].filter(Boolean).join(" · ");
        return (
          <li key={bill.id} className="flex flex-wrap items-center gap-x-2">
            <div className="flex min-w-0 flex-1 basis-56 items-center gap-4 py-2">
              <CategoryIcon category="other" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="body-strong [overflow-wrap:anywhere]">{bill.name}</span>
                <span className="caption text-text-muted [overflow-wrap:anywhere]">{subtitle}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end whitespace-nowrap">
                <Amount cents={bill.expectedCents} size="sm" locale={locale} {...hidden} />
                <span className="caption text-text-muted"><BillStatus state={state} /></span>
              </span>
            </div>
            {today !== null && <Actions bill={bill} state={state} {...actions} />}
          </li>
        );
      })}
    </ul>
  );
}

/** Next month's Bills, read-only: name, due date and amount. */
export function NextMonthRows({ rows, caption }: { rows: Bill[]; caption: string }) {
  const { locale } = useI18n();
  const hidden = useHiddenProps();
  return (
    <ul aria-label={caption} className="divide-y divide-border">
      {rows.map((bill) => (
        <li key={bill.id}>
          <ListRow leading={<CategoryIcon category="other" />} title={bill.name} cents={bill.expectedCents} end={<Badge>{formatDay(bill.dueDate, locale)}</Badge>} locale={locale} {...hidden} />
        </li>
      ))}
    </ul>
  );
}

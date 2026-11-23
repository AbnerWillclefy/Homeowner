import { Badge, Menu } from "@homeowner/bedrock";
import { CategoryIcon, formatAmount, ListRow } from "@homeowner/bedrock/finance";
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
  /** Ids of the Bills whose paid mark is being written; each one's action waits. */
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

/** The one action a row has: mark paid, or Undo for a Bill paid by hand. A Bill paid by the bank has none. Its accessible name carries the Bill, since it repeats down the list; the visible label stays short. */
function useAction(busy: ReadonlySet<string>, onPaid: RowsProps["onPaid"]) {
  const { t } = useI18n();
  return (bill: Bill, state: BillState) => {
    if (state === "paid-bank") return undefined;
    const undo = state === "paid-hand";
    return {
      label: t(undo ? "bills.undo" : "bills.markPaid"),
      name: t(undo ? "bills.undoNamed" : "bills.markPaidNamed", { name: bill.name }),
      icon: undo ? Undo2 : Check,
      variant: state === "overdue" ? ("primary" as const) : ("secondary" as const),
      loading: busy.has(bill.id),
      onClick: () => onPaid(bill, !undo),
    };
  };
}

/** One row per Bill, by due date. The row opens the edit Sheet; the action and the menu with Edit and Delete sit beside it. A past month has neither. */
export function BillRows({ rows, caption, today, busy, onPaid, onEdit, onDelete }: RowsProps) {
  const { locale, t } = useI18n();
  const hidden = useHiddenProps();
  const note = useNote();
  const action = useAction(busy, onPaid);
  return (
    <ul aria-label={caption} className="divide-y divide-border">
      {rows.map((bill) => {
        const state = billState(bill, today);
        const subtitle = [t("bills.dueOn", { date: formatDay(bill.dueDate, locale) }), note(bill, state)].filter(Boolean).join(" · ");
        const row = (
          <ListRow
            asChild={today !== null}
            leading={<CategoryIcon category="other" />}
            title={bill.name}
            subtitle={subtitle}
            cents={bill.expectedCents}
            end={<BillStatus state={state} />}
            locale={locale}
            action={today === null ? undefined : action(bill, state)}
            {...hidden}
          >
            {today !== null && <button type="button" onClick={() => onEdit(bill)} />}
          </ListRow>
        );
        return (
          <li key={bill.id}>
            {today === null ? row : (
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">{row}</div>
                <Menu
                  label={t("bills.menu", { name: bill.name })}
                  closeLabel={t("app.close")}
                  items={[
                    { label: t("bills.edit"), icon: Pencil, onSelect: () => onEdit(bill) },
                    { label: t("bills.delete"), icon: Trash2, danger: true, onSelect: () => onDelete(bill) },
                  ]}
                />
              </div>
            )}
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

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import type { Transaction } from "../api/api";
import { formatDay } from "../logic/month";
import { groupByDay } from "../logic/sameDays";
import { spendingKey, type SpendingCategory } from "../logic/spendingCategories";
import { Bar } from "./charts/Bar";
import { TransactionRow } from "./TransactionRow";

/**
 * One Spending Category as a Bar. The name is the disclosure button (the amount and last month's value are text under
 * it); opening lists the Transactions by day, newest first, each still editable.
 */
export function CategoryBar({
  category,
  spent,
  max,
  marker,
  note,
  transactions,
  onEdit,
}: {
  category: SpendingCategory;
  spent: number;
  max: number;
  /** Last month's same-days value, or undefined when there is nothing to compare with. */
  marker?: number | undefined;
  note?: string | undefined;
  transactions: Transaction[];
  onEdit(tx: Transaction): void;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  const days = groupByDay(transactions);
  return (
    <li className="m-0 flex list-none flex-col gap-2">
      <Bar
        label={
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-body`}
            disabled={days.length === 0}
            onClick={() => setOpen((value) => !value)}
            className="flex min-h-11 w-full items-center gap-3 rounded-control bg-transparent p-0 text-start font-[inherit] font-semibold text-inherit"
          >
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{t(spendingKey(category))}</span>
            {days.length > 0 && (
              <ChevronDown
                aria-hidden="true"
                size={22}
                className={`shrink-0 text-muted motion-safe:transition-transform motion-safe:duration-150 ${open ? "rotate-180" : ""}`}
              />
            )}
          </button>
        }
        value={spent}
        max={max}
        markers={marker === undefined ? [] : [marker]}
        note={note}
      />
      <div id={`${id}-body`} hidden={!open} className="flex flex-col gap-1">
        {days.map(({ day, transactions: rows }) => (
          <section key={day} className="flex flex-col">
            <h5 className="m-0 text-sm font-semibold text-muted">{formatDay(day, locale)}</h5>
            <ul className="m-0 flex flex-col p-0">
              {rows.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} onEdit={onEdit} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </li>
  );
}

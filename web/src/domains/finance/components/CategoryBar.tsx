import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import type { Transaction } from "../api/api";
import { limitText } from "../logic/limit";
import { formatCents } from "../logic/money";
import { formatDay } from "../logic/month";
import { groupByDay } from "../logic/sameDays";
import { spendingKey, type SpendingCategory } from "../logic/spendingCategories";
import type { useHistory } from "../hooks/useHistory";
import { CategoryHistory } from "./CategoryHistory";
import { Track } from "./charts/Bar";
import { LimitForm } from "./LimitForm";
import { TransactionRow } from "./TransactionRow";

/**
 * One Spending Category: its name and amount are the disclosure button, the bar and a line of counts and last
 * month's value under it; opening lists the Transactions by day, newest first, each still editable.
 */
export function CategoryBar({
  category,
  spent,
  max,
  marker,
  note,
  transactions,
  history,
  month,
  thisMonth,
  limit,
  onLimit,
  onEdit,
}: {
  category: SpendingCategory;
  spent: number;
  max: number;
  /** Last month's same-days value, or undefined when there is nothing to compare with. */
  marker?: number | undefined;
  note?: string | undefined;
  transactions: Transaction[];
  history: ReturnType<typeof useHistory>;
  month: string;
  thisMonth: string;
  /** The Spending limit in cents, or undefined when there is none. */
  limit: number | undefined;
  onLimit(category: SpendingCategory, cents: number | null): Promise<"saved" | "failed">;
  onEdit(tx: Transaction): void;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  const days = groupByDay(transactions);
  const standing = limit === undefined ? null : limitText(spent, limit);
  const lines = [t("finances.spending.count", { count: transactions.length }), note].filter(Boolean).join(" · ");
  return (
    <li className="m-0 flex list-none flex-col gap-2 border-t border-chart-track py-3 first:border-t-0 first:pt-0 last:pb-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        disabled={days.length === 0}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full flex-wrap items-center gap-x-3 rounded-control bg-transparent p-0 text-start font-[inherit] text-inherit"
      >
        <span className="min-w-0 flex-1 font-bold [overflow-wrap:anywhere]">{t(spendingKey(category))}</span>
        <span className="flex items-center gap-2 font-bold">
          {formatCents(spent, locale)}
          {days.length > 0 && (
            <ChevronDown
              aria-hidden="true"
              size={20}
              className={`shrink-0 text-muted motion-safe:transition-transform motion-safe:duration-150 ${open ? "rotate-180" : ""}`}
            />
          )}
        </span>
      </button>
      <Track value={spent} max={max} markers={marker === undefined ? [] : [marker]} limit={limit} />
      <span className="text-sm text-muted [overflow-wrap:anywhere]">
        {lines}
        {standing && limit !== undefined && (
          <span className="block">{t(`finances.limit.${standing.key}`, { limit: formatCents(limit, locale), amount: formatCents(standing.amount, locale) })}</span>
        )}
      </span>
      <div id={`${id}-body`} hidden={!open} className="flex flex-col gap-3">
        <LimitForm limit={limit} onSave={(cents) => onLimit(category, cents)} />
        <CategoryHistory category={category} history={history} marked={month} thisMonth={thisMonth} />
        <div className="flex flex-col gap-2 rounded-control bg-surface px-3 py-2">
          {days.map(({ day, transactions: rows }) => (
            <section key={day} className="flex flex-col">
              <h5 className="m-0 pt-1 text-sm font-bold text-muted">{formatDay(day, locale)}</h5>
              <ul className="m-0 flex flex-col p-0">
                {rows.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} onEdit={onEdit} showDate={false} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </li>
  );
}

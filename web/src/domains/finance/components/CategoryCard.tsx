import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { Card } from "../../../shared/ui/Card";
import type { Transaction } from "../api/api";
import { formatCents } from "../logic/money";
import type { CategoryGroup } from "../logic/monthView";
import { spendingKey } from "../logic/spendingCategories";
import { TransactionRow } from "./TransactionRow";

/**
 * A Spending Category, its total and, once the report is in, last month's; the head is one full-width button that
 * opens its Transactions (the disclosure pattern). Neutral colours only: the Chore Category pastels name a different
 * vocabulary.
 */
export function CategoryCard({ group, lastMonth, onEdit }: { group: CategoryGroup; lastMonth?: string; onEdit(tx: Transaction): void }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <Card as="section" aria-labelledby={`${id}-title`} className="mt-0 flex flex-col gap-2">
      <h4 className="m-0 text-base font-bold leading-snug">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 w-full items-start gap-3 rounded-control bg-transparent p-0 text-start font-[inherit] text-inherit"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span id={`${id}-title`} className="[overflow-wrap:anywhere]">
              {t(spendingKey(group.category))}
            </span>
            <span className="text-sm font-normal text-muted">{t("finances.month.count", { count: group.transactions.length })}</span>
            <span className="text-lg">{formatCents(group.spentCents, locale)}</span>
            {lastMonth && <span className="text-sm font-normal text-muted [overflow-wrap:anywhere]">{lastMonth}</span>}
          </span>
          <ChevronDown
            aria-hidden="true"
            size={22}
            className={`mt-1 shrink-0 text-muted motion-safe:transition-transform motion-safe:duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h4>
      <ul id={`${id}-body`} hidden={!open} className="m-0 flex flex-col p-0">
        {group.transactions.map((tx) => (
          <TransactionRow key={tx.id} tx={tx} onEdit={onEdit} />
        ))}
      </ul>
    </Card>
  );
}

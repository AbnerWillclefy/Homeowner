import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { Card } from "../../../shared/ui/Card";
import type { Transaction } from "../api/api";
import { formatCents } from "../logic/money";
import { spent } from "../logic/monthView";
import { TransactionRow } from "./TransactionRow";

/** One kind left out of the totals: what it is, how many and how much, opening to its rows. */
function Kind({ title, rows, cents, onEdit }: { title: string; rows: Transaction[]; cents: number; onEdit(tx: Transaction): void }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <li className="m-0 flex list-none flex-col border-t border-chart-track py-2 first:border-t-0 first:pt-0 last:pb-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full flex-wrap items-center gap-x-3 rounded-control bg-transparent p-0 text-start font-[inherit] text-inherit"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-bold [overflow-wrap:anywhere]">{title}</span>
          <span className="text-sm text-muted">{t("finances.spending.count", { count: rows.length })}</span>
        </span>
        <span className="flex items-center gap-2 font-bold">
          {formatCents(cents, locale)}
          <ChevronDown aria-hidden="true" size={20} className={`shrink-0 text-muted motion-safe:transition-transform motion-safe:duration-150 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <ul id={id} hidden={!open} className="m-0 mt-2 flex flex-col rounded-control bg-surface px-3 py-1">
        {rows.map((tx) => (
          <TransactionRow key={tx.id} tx={tx} onEdit={onEdit} />
        ))}
      </ul>
    </li>
  );
}

/**
 * "Fora dos totais": income, Transfers and money put aside, none counted in spending. Income adds up what came in;
 * Transfers add up what went out, such as a card bill payment, since each one's other half is money in; Savings add
 * up what is still put aside, net of withdrawals (Resgates). `upcoming` are card
 * charges already made that count on a later bill, listed here so they can be edited before their month opens.
 */
export function LeftOutGroup({
  transfers,
  savings,
  income,
  upcoming = [],
  onEdit,
}: {
  transfers: Transaction[];
  savings: Transaction[];
  income: Transaction[];
  upcoming?: Transaction[];
  onEdit(tx: Transaction): void;
}) {
  const { t } = useI18n();
  const id = useId();
  if (transfers.length === 0 && savings.length === 0 && income.length === 0 && upcoming.length === 0) return null;
  const kinds = [
    { title: t("finances.month.upcoming"), rows: upcoming, cents: upcoming.reduce((sum, tx) => sum + spent(tx), 0) },
    { title: t("finances.month.income"), rows: income, cents: income.reduce((sum, tx) => sum + tx.amountCents, 0) },
    { title: t("finances.month.transfers"), rows: transfers, cents: transfers.reduce((sum, tx) => sum + Math.max(0, -tx.amountCents), 0) },
    // Net of withdrawals (Resgates), which are money in: what is still put aside.
    { title: t("finances.month.saving"), rows: savings, cents: savings.reduce((sum, tx) => sum - tx.amountCents, 0) },
  ].filter((k) => k.rows.length > 0);
  return (
    <section aria-labelledby={id} className="mt-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 id={id} className="m-0 text-2xl font-bold leading-snug [overflow-wrap:anywhere]">
          {t("finances.month.leftOut")}
        </h3>
        <p className="m-0 text-sm text-muted">{t("finances.month.leftOutHint")}</p>
      </div>
      <Card>
        <ul className="m-0 flex flex-col p-0">
          {kinds.map((k) => (
            <Kind key={k.title} {...k} onEdit={onEdit} />
          ))}
        </ul>
      </Card>
    </section>
  );
}

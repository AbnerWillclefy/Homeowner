import { Card } from "@homeowner/bedrock";
import { formatAmount } from "@homeowner/bedrock/finance";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Transaction } from "../api/api";
import { formatDay } from "../logic/month";
import { spent } from "../logic/monthView";

/** One kind left out of the totals: what it is, how many and how much, opening to its rows. */
function Kind({ title, rows, cents }: { title: string; rows: Transaction[]; cents: number }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <li className="flex flex-col border-t border-border py-2 first:border-t-0 first:pt-0 last:pb-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full flex-wrap items-center gap-x-3 rounded-md bg-transparent p-0 text-left text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="body-strong [overflow-wrap:anywhere]">{title}</span>
          <span className="caption text-text-muted">{t(rows.length === 1 ? "overview.leftOut.countOne" : "overview.leftOut.countMany", { count: rows.length })}</span>
        </span>
        <span className="body-strong flex items-center gap-2 tabular-nums">
          {formatAmount(cents, { locale })}
          <ChevronDown aria-hidden className={`size-5 shrink-0 text-text-muted motion-safe:transition-transform motion-safe:duration-150 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <ul id={id} hidden={!open} className="mt-2 flex flex-col rounded-md bg-surface-sunken px-3 py-1">
        {rows.map((tx) => (
          <li key={tx.id} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
            <span className="flex min-w-0 flex-1 basis-32 flex-col">
              <span className="[overflow-wrap:anywhere]">{tx.description}</span>
              <span className="caption text-text-muted">{formatDay(tx.postedOn, locale)} · {tx.sourceName}</span>
            </span>
            <span className="tabular-nums">{formatAmount(Math.abs(tx.amountCents), { locale })}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * Income, Transfers and money put aside: none counted in spending. Income adds up what came in; Transfers what went
 * out; Savings what is still put aside, net of withdrawals (Resgates).
 */
export function LeftOutGroup({ transfers, savings, income }: { transfers: Transaction[]; savings: Transaction[]; income: Transaction[] }) {
  const { t } = useI18n();
  const kinds = [
    { title: t("overview.leftOut.income"), rows: income, cents: income.reduce((sum, tx) => sum + tx.amountCents, 0) },
    { title: t("overview.leftOut.transfers"), rows: transfers, cents: transfers.reduce((sum, tx) => sum + Math.max(0, -tx.amountCents), 0) },
    { title: t("overview.leftOut.saving"), rows: savings, cents: savings.reduce((sum, tx) => sum + spent(tx), 0) },
  ].filter((k) => k.rows.length > 0);
  if (kinds.length === 0) return null;
  return (
    <Card>
      <div className="flex flex-col gap-1">
        <h2 className="section-title">{t("overview.leftOut.heading")}</h2>
        <p className="caption text-text-muted">{t("overview.leftOut.hint")}</p>
      </div>
      <ul className="flex flex-col">
        {kinds.map((k) => (
          <Kind key={k.title} {...k} />
        ))}
      </ul>
    </Card>
  );
}

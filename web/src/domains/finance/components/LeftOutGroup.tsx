import { useId } from "react";
import { useI18n } from "../../../shared/i18n";
import { Card } from "../../../shared/ui/Card";
import type { Transaction } from "../api/api";
import { TransactionRow } from "./TransactionRow";

/** "Fora dos totais": Transfers and income in one section, neither counted in any total. */
export function LeftOutGroup({ transfers, income, onEdit }: { transfers: Transaction[]; income: Transaction[]; onEdit(tx: Transaction): void }) {
  const { t } = useI18n();
  const id = useId();
  if (transfers.length === 0 && income.length === 0) return null;
  return (
    <Card as="section" aria-labelledby={id} className="mt-0 flex flex-col gap-2">
      <h4 id={id} className="m-0 text-base font-bold leading-snug [overflow-wrap:anywhere]">
        {t("finances.month.leftOut")}
      </h4>
      {[
        { title: t("finances.month.transfers"), rows: transfers },
        { title: t("finances.month.income"), rows: income },
      ].map(({ title, rows }) =>
        rows.length === 0 ? null : (
          <div key={title} role="group" aria-label={title} className="flex flex-col">
            <h5 className="m-0 text-sm font-semibold text-muted [overflow-wrap:anywhere]">{title}</h5>
            <ul className="m-0 flex flex-col p-0">
              {rows.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} onEdit={onEdit} />
              ))}
            </ul>
          </div>
        ),
      )}
    </Card>
  );
}

import { useId } from "react";
import { useI18n } from "../../../shared/i18n";
import { Card } from "../../../shared/ui/Card";
import type { Transaction } from "../api/api";
import { TransactionRow } from "./TransactionRow";

/** The Expenses nothing could categorise; each row opens the edit dialog, where the Resident picks one. Hidden when there are none. */
export function UncategorisedCard({ rows, onEdit }: { rows: Transaction[]; onEdit(tx: Transaction): void }) {
  const { t } = useI18n();
  const id = useId();
  if (rows.length === 0) return null;
  return (
    <Card as="section" aria-labelledby={id} className="mt-0 flex flex-col gap-1">
      <h4 id={id} className="m-0 text-base font-bold leading-snug [overflow-wrap:anywhere]">
        {t("finances.uncategorised.title")}
      </h4>
      <p className="m-0 text-sm text-muted">{t("finances.uncategorised.count", { count: rows.length })}</p>
      <ul className="m-0 flex flex-col p-0">
        {rows.map((tx) => (
          <TransactionRow key={tx.id} tx={tx} onEdit={onEdit} />
        ))}
      </ul>
    </Card>
  );
}

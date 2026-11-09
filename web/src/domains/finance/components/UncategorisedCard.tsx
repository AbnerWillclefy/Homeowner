import { Tag } from "lucide-react";
import { useId, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import type { Transaction } from "../api/api";
import { TransactionRow } from "./TransactionRow";

/**
 * The Expenses nothing could categorise, as one card: how many, and a button that lists them; each row opens the
 * edit dialog, where the Resident picks one. Hidden when there are none.
 */
export function UncategorisedCard({ rows, onEdit }: { rows: Transaction[]; onEdit(tx: Transaction): void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  if (rows.length === 0) return null;
  return (
    <Card as="section" aria-labelledby={id} className="mt-0 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-control bg-chart-track text-muted">
          <Tag size={20} />
        </span>
        <div className="flex min-w-0 flex-col">
          <h4 id={id} className="m-0 text-lg font-bold leading-snug [overflow-wrap:anywhere]">
            {t("finances.uncategorised.title", { count: rows.length })}
          </h4>
          <p className="m-0 text-sm text-muted">{t("finances.uncategorised.count")}</p>
        </div>
      </div>
      {open ? (
        <ul className="m-0 flex flex-col p-0">
          {rows.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} onEdit={onEdit} />
          ))}
        </ul>
      ) : (
        <Button className="self-end" onClick={() => setOpen(true)}>
          {t("finances.uncategorised.open")}
        </Button>
      )}
    </Card>
  );
}

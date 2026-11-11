import { useId, useState, type FormEvent } from "react";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { AppDialog } from "../../../shared/ui/AppDialog";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { FormError } from "../../../shared/ui/FormError";
import { RADIO_CARD } from "../../../shared/ui/radioCard";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";
import type { Transaction, TransactionType } from "../api/api";
import type { EditOutcome } from "../hooks/useMonth";
import { editFor, type TransactionEdit } from "../logic/edit";
import { formatCents } from "../logic/money";
import { SPENDING_CATEGORIES, spendingKey, type SpendingCategory } from "../logic/spendingCategories";

const TYPES: { type: TransactionType; key: MessageKey }[] = [
  { type: "income", key: "finances.type.income" },
  { type: "expense", key: "finances.type.expense" },
  { type: "transfer", key: "finances.type.transfer" },
  { type: "saving", key: "finances.type.saving" },
];

/** Changes a Transaction's type and, for an Expense, its Spending Category. A failed save stays open to retry. */
export function EditTransactionDialog({
  tx,
  save,
  onClose,
}: {
  tx: Transaction;
  save(id: string, edit: TransactionEdit): Promise<EditOutcome>;
  onClose(outcome: EditOutcome | "cancelled"): void;
}) {
  const { t, locale } = useI18n();
  const formId = useId();
  const [type, setType] = useState(tx.type);
  const [category, setCategory] = useState<SpendingCategory>(tx.spendingCategory ?? "other");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const { run } = useSubmitOnce(async () => {
    const edit = editFor(tx, type, category);
    if (!edit) return onClose("cancelled");
    setSaving(true);
    setFailed(false);
    const outcome = await save(tx.id, edit);
    if (outcome === "failed") {
      setSaving(false);
      setFailed(true);
    } else onClose(outcome);
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void run();
  }

  return (
    <AppDialog
      size="sheet"
      title={t("finances.edit.title")}
      description={
        <p className="mb-0 [overflow-wrap:anywhere]">
          {tx.description} · {formatCents(tx.amountCents, locale)}
        </p>
      }
      onDismiss={() => onClose("cancelled")}
      dismissible={!saving}
      footer={
        <ButtonRow
          start={
            <Button variant="secondary" disabled={saving} onClick={() => onClose("cancelled")}>
              {t("finances.edit.cancel")}
            </Button>
          }
          end={
            <Button type="submit" form={formId} pending={saving}>
              {t("finances.edit.save")}
            </Button>
          }
        />
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-6">
        <fieldset className="m-0 min-w-0 border-0 p-0" disabled={saving}>
          <legend className="p-0 text-lg font-semibold">{t("finances.edit.type")}</legend>
          <div className="mt-3 flex flex-col gap-2">
            {TYPES.map((option) => (
              <label key={option.type} className={RADIO_CARD}>
                <input
                  type="radio"
                  name={`${formId}-type`}
                  className="sr-only"
                  checked={type === option.type}
                  onChange={() => setType(option.type)}
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">{t(option.key)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {type === "expense" && (
          <div>
            <label htmlFor={`${formId}-category`} className="mt-0 text-lg">
              {t("finances.edit.category")}
            </label>
            <select
              id={`${formId}-category`}
              value={category}
              disabled={saving}
              onChange={(event) => setCategory(event.target.value as SpendingCategory)}
            >
              {SPENDING_CATEGORIES.map((id) => (
                <option key={id} value={id}>
                  {t(spendingKey(id))}
                </option>
              ))}
            </select>
          </div>
        )}
        <FormError form="finances-edit">{failed && t("finances.edit.failed")}</FormError>
      </form>
    </AppDialog>
  );
}

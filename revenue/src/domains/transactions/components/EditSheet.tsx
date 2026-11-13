import { Button, Select, Sheet } from "@homeowner/bedrock";
import { formatAmount } from "@homeowner/bedrock/finance";
import { useId, useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { TYPES, type Transaction, type TransactionEdit, type TransactionType } from "../api";
import { SPENDING_CATEGORIES, spendingKey, type SpendingCategory } from "../logic/categories";
import { editFor } from "../logic/edit";

/**
 * Changes a Transaction's type and, for an Expense, its Spending Category. Saving closes the sheet at once: the row
 * updates on the screen and says so if the API refuses.
 */
export function EditSheet({ tx, onSave, onClose }: { tx: Transaction; onSave(edit: TransactionEdit): void; onClose(): void }) {
  const { t, locale } = useI18n();
  const formId = useId();
  const [type, setType] = useState<TransactionType>(tx.type);
  const [category, setCategory] = useState<SpendingCategory>(tx.spendingCategory ?? "other");

  function submit(event: FormEvent) {
    event.preventDefault();
    const edit = editFor(tx, type, category);
    if (edit) onSave(edit);
    onClose();
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("tx.edit.title")}
      subtitle={`${tx.description} · ${formatAmount(tx.amountCents, { locale })}`}
      closeLabel={t("app.close")}
      footer={
        <Button type="submit" form={formId}>
          {t("tx.edit.save")}
        </Button>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-1">
          <legend className="label pb-2 text-text-muted">{t("tx.edit.type")}</legend>
          {TYPES.map((option) => (
            <label key={option} className="body flex min-h-11 items-center gap-3 [overflow-wrap:anywhere]">
              <input type="radio" name={`${formId}-type`} className="size-5 accent-brand" checked={type === option} onChange={() => setType(option)} />
              {t(`tx.type.${option}`)}
            </label>
          ))}
        </fieldset>
        {type === "expense" && (
          <Select
            label={t("tx.edit.category")}
            value={category}
            onValueChange={(v) => setCategory(v as SpendingCategory)}
            options={SPENDING_CATEGORIES.map((id) => ({ value: id, label: t(spendingKey(id)) }))}
          />
        )}
      </form>
    </Sheet>
  );
}

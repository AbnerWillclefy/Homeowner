import { Banner, Button, Input, Select, Sheet } from "@homeowner/bedrock";
import { useId, useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { formatDay } from "../../../shared/month/month";
import { TYPES, type Transaction, type TransactionEdit, type TransactionType } from "../api";
import type { EditOutcome } from "../hooks/useTransactions";
import { SPENDING_CATEGORIES, spendingKey, type SpendingCategory } from "../logic/categories";
import { editFor, noteTooLong } from "../logic/edit";
import { Money } from "./Money";

/**
 * The Transaction's detail, in the side panel: its amount, and its type and, for an Expense, its Spending Category to
 * change, and its Note. The sheet stays open until the save answers; a refusal shows inside it, with what was typed kept.
 */
export function EditSheet({ tx, onSave, onClose }: { tx: Transaction; onSave(edit: TransactionEdit): Promise<EditOutcome>; onClose(): void }) {
  const { t, locale } = useI18n();
  const formId = useId();
  const [type, setType] = useState<TransactionType>(tx.type);
  const [category, setCategory] = useState<SpendingCategory>(tx.spendingCategory ?? "other");
  const [note, setNote] = useState(tx.note ?? "");
  const [saving, setSaving] = useState(false);
  const [refused, setRefused] = useState<EditOutcome | null>(null);
  const tooLong = noteTooLong(note) || refused === "note-too-long";
  const date = formatDay(tx.postedOn, locale);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || noteTooLong(note)) return;
    const edit = editFor(tx, type, category, note);
    if (!edit) return onClose();
    setSaving(true);
    setRefused(null);
    const outcome = await onSave(edit);
    setSaving(false);
    if (outcome === "ok" || outcome === "gone") onClose();
    else setRefused(outcome);
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && !saving && onClose()}
      title={tx.description}
      subtitle={`${tx.sourceName} · ${date}`}
      closeLabel={t("app.close")}
      footer={
        <Button type="submit" form={formId} disabled={saving}>
          {t("tx.edit.save")}
        </Button>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-6">
        <Money tx={tx} size="lg" />
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
        <Input
          label={t("tx.edit.noteLabel")}
          value={note}
          onChange={(e) => { setNote(e.target.value); setRefused(null); }}
          hint={tx.installment ? t("tx.edit.noteAllParts") : undefined}
          error={tooLong ? t("tx.edit.noteTooLong") : undefined}
        />
        <dl className="body flex flex-col gap-2 border-t border-border pt-4">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">{t("tx.edit.source")}</dt>
            <dd className="text-right [overflow-wrap:anywhere]">{tx.sourceName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">{t("tx.edit.date")}</dt>
            <dd className="text-right">{date}</dd>
          </div>
        </dl>
        {refused === "failed" && <Banner tone="danger">{t("tx.edit.failed")}</Banner>}
      </form>
    </Sheet>
  );
}

import { Banner, Button, Input, Sheet } from "@homeowner/bedrock";
import { MoneyInput } from "@homeowner/bedrock/finance";
import { useId, useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Bill, BillInput } from "../api";
import type { SaveOutcome } from "../hooks/useBills";
import { billFieldErrorKey, billInputOf } from "../logic/billForm";

/**
 * Adds a Bill, or edits `bill`. Field problems show beside their fields, from our own checks and from the API's 400
 * `fields`; a failed save stays open to try again. `initial` prefills a new Bill, for example from a suggestion.
 */
export function BillFormSheet({ bill, initial, save, onClose }: { bill: Bill | null; initial?: BillInput; save(input: BillInput): Promise<SaveOutcome>; onClose(): void }) {
  const { t, locale } = useI18n();
  const formId = useId();
  const start = bill ?? initial;
  const [name, setName] = useState(start?.name ?? "");
  const [cents, setCents] = useState<number | null>(start?.expectedCents ?? null);
  const [dueDay, setDueDay] = useState(start ? String(start.dueDay) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFailed(false);
    const result = billInputOf({ name, cents, dueDay });
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    setSaving(true);
    const outcome = await save(result.input);
    setSaving(false);
    if (outcome.kind === "ok") onClose();
    else if (outcome.kind === "fields") setErrors(outcome.fields);
    else setFailed(true);
  }

  const error = (field: string) => (errors[field] ? t(billFieldErrorKey(field, errors[field])) : undefined);

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && !saving && onClose()}
      title={t(bill ? "bills.form.editTitle" : "bills.form.addTitle")}
      closeLabel={t("app.close")}
      footer={
        <Button type="submit" form={formId} loading={saving}>
          {t("bills.form.save")}
        </Button>
      }
    >
      <form id={formId} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        <Input label={t("bills.form.name")} value={name} onChange={(e) => setName(e.target.value)} error={error("name")} autoComplete="off" maxLength={120} disabled={saving} />
        <MoneyInput label={t("bills.form.amount")} value={cents} onValueChange={setCents} error={error("expectedCents")} locale={locale} />
        <Input
          label={t("bills.form.dueDay")}
          hint={t("bills.form.dueDayHint")}
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value)}
          error={error("dueDay")}
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          disabled={saving}
        />
        {failed && <Banner tone="danger">{t("bills.failed")}</Banner>}
      </form>
    </Sheet>
  );
}

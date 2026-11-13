import { Banner, Button, Input, Sheet } from "@homeowner/bedrock";
import { useId, useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { MessageKey } from "../../../shared/i18n/catalogs";
import type { BillDaysResult, CardSource } from "../api";
import { readBillDays } from "../logic/billDays";

const FIELDS = ["closeDay", "dueDay"] as const;
type Problems = { closeDay?: string; dueDay?: string };

const problemKey = (field: (typeof FIELDS)[number], code: string): MessageKey =>
  code === "required" ? `cardBills.days.${field}.required` : `cardBills.days.${field}.invalid`;

/** Sets a card's closing and due days together: both are saved, or both cleared, never one. A failed save stays open to try again. */
export function BillDaysSheet({ card, save, onClose }: { card: CardSource; save(closeDay: number | null, dueDay: number | null): Promise<BillDaysResult>; onClose(): void }) {
  const { t } = useI18n();
  const formId = useId();
  const [close, setClose] = useState(card.closeDay === null ? "" : String(card.closeDay));
  const [due, setDue] = useState(card.dueDay === null ? "" : String(card.dueDay));
  const [problems, setProblems] = useState<Problems>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFailed(false);
    const read = readBillDays(close, due);
    if (!read.ok) return setProblems(read.errors);
    setProblems({});
    setSaving(true);
    const result = await save(read.closeDay, read.dueDay);
    setSaving(false);
    if (result.kind === "ok" || result.kind === "not-found") onClose();
    else if (result.kind === "fields") setProblems(result.fields);
    else setFailed(true);
  }

  const values = { closeDay: [close, setClose], dueDay: [due, setDue] } as const;
  return (
    <Sheet
      open
      onOpenChange={(open) => !open && !saving && onClose()}
      title={t("cardBills.days.title", { name: card.name })}
      subtitle={t("cardBills.days.why")}
      closeLabel={t("app.close")}
      footer={<Button type="submit" form={formId} loading={saving}>{t("cardBills.days.save")}</Button>}
    >
      <form id={formId} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        {FIELDS.map((field) => (
          <Input
            key={field}
            label={t(`cardBills.days.${field}`)}
            hint={t("cardBills.days.hint")}
            value={values[field][0]}
            onChange={(e) => values[field][1](e.target.value)}
            error={problems[field] ? t(problemKey(field, problems[field])) : undefined}
            inputMode="numeric"
            autoComplete="off"
            disabled={saving}
          />
        ))}
        <p className="caption text-text-muted">{t("cardBills.days.clear")}</p>
        {failed && <Banner tone="danger">{t("cardBills.days.failed")}</Banner>}
      </form>
    </Sheet>
  );
}

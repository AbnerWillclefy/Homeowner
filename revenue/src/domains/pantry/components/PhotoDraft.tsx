import { Banner, Button, Input } from "@homeowner/bedrock";
import { Amount, MoneyInput } from "@homeowner/bedrock/finance";
import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { MessageKey } from "../../../shared/i18n/catalogs";
import { saoPauloDay } from "../../../shared/month/month";
import type { ReceiptDraft } from "../api";
import type { Step } from "../logic/addReceipt";
import { blankLine, formOf, SUM_TOLERANCE_CENTS, sumCents, validate, type DraftForm, type DraftLineForm } from "../logic/photoDraft";

type Draft = Extract<Step, { kind: "draft" }>;

/** Message by the last part of a field code: `lines.2.description` and `description` read the same. */
const ERRORS: Record<string, MessageKey> = {
  storeName: "receipt.err.storeName",
  issuedOn: "receipt.err.issuedOn",
  totalCents: "receipt.err.totalCents",
  lines: "receipt.err.lines",
  description: "receipt.err.description",
  quantityMilli: "receipt.err.quantityMilli",
  unit: "receipt.err.unit",
  unitPriceCents: "receipt.err.amount",
};

/**
 * What the model read, as fields to correct. Nothing is saved until "Salvar nota"; a save the API refuses keeps every
 * edit and marks the fields it names. The form is local state so it survives a refused save.
 */
export function PhotoDraft({ step, onSave }: { step: Draft; onSave(draft: ReceiptDraft): void }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const [form, setForm] = useState<DraftForm>(() => formOf(step.draft, locale));
  const [next, setNext] = useState(form.lines.length);
  const [local, setLocal] = useState<Record<string, string>>({});
  const today = saoPauloDay(new Date());

  // The User's own check first; the API's marks stay until the next save.
  const marks: Record<string, string> = Object.keys(local).length > 0 ? local : Object.fromEntries(step.fields.map((f) => [f, "invalid"]));
  const hasMarks = Object.keys(marks).length > 0;
  const error = (code: string, key?: string) => (marks[code] ? t(ERRORS[key ?? code] ?? "receipt.err.amount") : undefined);

  const edit = (patch: Partial<DraftForm>) => setForm((f) => ({ ...f, ...patch }));
  const editLine = (i: number, patch: Partial<DraftLineForm>) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (step.saving) return;
    const checked = validate(form, today);
    setLocal(checked.ok ? {} : checked.errors);
    if (checked.ok) onSave(checked.draft);
  };

  const sum = sumCents(form);
  const off = form.totalCents !== null && Math.abs(sum - form.totalCents) > SUM_TOLERANCE_CENTS;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="body text-text-muted">{t("receipt.draftText")}</p>
      {step.failed && <Banner tone="danger">{t("receipt.saveFailed")}</Banner>}
      {hasMarks && <Banner tone="danger">{t("receipt.checkFields")}</Banner>}

      <Input label={t("receipt.store")} value={form.storeName} onChange={(e) => edit({ storeName: e.target.value })} error={error("storeName")} autoComplete="off" />
      <div className="grid grid-cols-2 gap-4">
        <Input label={t("receipt.date")} type="date" max={today} value={form.issuedOn} onChange={(e) => edit({ issuedOn: e.target.value })} error={error("issuedOn")} />
        <MoneyInput label={t("receipt.total")} value={form.totalCents} onValueChange={(totalCents) => edit({ totalCents })} locale={locale} error={error("totalCents")} />
      </div>
      <p className={off ? "caption text-danger" : "caption text-text-muted"}>
        {t("receipt.sum")}{" "}
        <Amount cents={sum} size="sm" locale={locale} {...hidden} />
        {form.totalCents !== null && <> · {t("receipt.total")} <Amount cents={form.totalCents} size="sm" locale={locale} {...hidden} /></>}
      </p>

      <h3 className="section-title">{t("receipt.lines")}</h3>
      {error("lines") && <p role="alert" className="caption text-danger">{error("lines")}</p>}
      <ul className="flex flex-col gap-4">
        {form.lines.map((line, i) => {
          const at = (field: string) => `lines.${i + 1}.${field}`;
          return (
            <li key={line.key}>
              <fieldset className="flex flex-col gap-4 rounded-md bg-surface-sunken p-4">
                <legend className="body-strong px-1">{t("receipt.line", { n: i + 1 })}</legend>
                <Input label={t("receipt.description")} value={line.description} onChange={(e) => editLine(i, { description: e.target.value })} error={error(at("description"), "description")} autoComplete="off" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label={t("receipt.quantity")} inputMode="decimal" value={line.quantity} onChange={(e) => editLine(i, { quantity: e.target.value })} error={error(at("quantityMilli"), "quantityMilli")} autoComplete="off" />
                  <Input label={t("receipt.unit")} value={line.unit} onChange={(e) => editLine(i, { unit: e.target.value })} error={error(at("unit"), "unit")} autoComplete="off" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <MoneyInput label={t("receipt.unitPrice")} value={line.unitPriceCents} onValueChange={(unitPriceCents) => editLine(i, { unitPriceCents })} locale={locale} error={error(at("unitPriceCents"), "unitPriceCents")} />
                  <MoneyInput label={t("receipt.lineTotal")} value={line.totalCents} onValueChange={(totalCents) => editLine(i, { totalCents })} locale={locale} error={error(at("totalCents"), "unitPriceCents")} />
                </div>
                <Button variant="ghost" icon={Trash2} onClick={() => edit({ lines: form.lines.filter((_, j) => j !== i) })}>{t("receipt.removeLine", { n: i + 1 })}</Button>
              </fieldset>
            </li>
          );
        })}
      </ul>
      <Button variant="secondary" icon={Plus} onClick={() => { edit({ lines: [...form.lines, blankLine(next)] }); setNext(next + 1); }}>{t("receipt.addLine")}</Button>
      <Button type="submit" loading={step.saving}>{t("receipt.save")}</Button>
    </form>
  );
}

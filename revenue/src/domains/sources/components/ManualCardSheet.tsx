import { Banner, Button, Input, Sheet } from "@homeowner/bedrock";
import { MoneyInput } from "@homeowner/bedrock/finance";
import { useId, useState, type FormEvent } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import { monthLabel } from "../../../shared/month/month";
import type { ManualCard, ManualCardInput } from "../api";
import type { ManualCardOutcome } from "../hooks/useManualCards";
import { manualCardFieldErrorKey, manualCardInputOf, manualMonths } from "../logic/manualCardForm";

interface Props {
  /** null adds one. */
  card: ManualCard | null;
  /** This month, the first of the 12 fields. */
  thisMonth: string;
  save(input: ManualCardInput): Promise<ManualCardOutcome>;
  remove(): Promise<ManualCardOutcome>;
  onClose(): void;
}

/**
 * Adds a manual card, or edits `card`: its name, due day, the bill typed for each of 12 months and the Pix recipient.
 * It stays open until the write answers, shows a refused field beside it and keeps what was typed when the write fails.
 */
export function ManualCardSheet({ card, thisMonth, save, remove, onClose }: Props) {
  const { t, locale } = useI18n();
  const formId = useId();
  const months = manualMonths(thisMonth);
  const [name, setName] = useState(card?.name ?? "");
  const [dueDay, setDueDay] = useState(card ? String(card.dueDay) : "");
  const [pix, setPix] = useState(card?.pixRecipient ?? "");
  const [bills, setBills] = useState<Record<string, number | null>>(card?.bills ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function run(write: () => Promise<ManualCardOutcome>, as: "save" | "delete") {
    if (busy) return;
    setFailed(false);
    setBusy(as);
    const outcome = await write();
    setBusy(null);
    if (outcome.kind === "ok") return onClose();
    setErrors(outcome.kind === "fields" ? outcome.fields : {});
    setFailed(outcome.kind === "failed");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = manualCardInputOf({ name, dueDay, pixRecipient: pix, bills }, months);
    setErrors(result.ok ? {} : result.errors);
    if (result.ok) void run(() => save(result.input), "save");
  }

  const error = (field: string) => (errors[field] ? t(manualCardFieldErrorKey(field, errors[field])) : undefined);

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title={t(card ? "manualCard.form.editTitle" : "manualCard.form.addTitle")}
      closeLabel={t("app.close")}
      footer={
        <div className="flex gap-2">
          {card && (
            <Button
              variant="secondary"
              loading={busy === "delete"}
              disabled={busy === "save"}
              onClick={() => (confirming ? void run(remove, "delete") : setConfirming(true))}
            >
              {t(confirming ? "manualCard.form.deleteConfirm" : "manualCard.form.delete")}
            </Button>
          )}
          <Button type="submit" form={formId} loading={busy === "save"} disabled={busy === "delete"} className="flex-1">
            {t("manualCard.form.save")}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        {confirming && <Banner tone="warning">{t("manualCard.form.deleteWarning")}</Banner>}
        <Input label={t("manualCard.form.name")} value={name} onChange={(e) => setName(e.target.value)} error={error("name")} autoComplete="off" maxLength={120} disabled={busy !== null} />
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
          disabled={busy !== null}
        />
        <fieldset className="flex flex-col gap-3">
          <legend className="body-strong">{t("manualCard.form.bills")}</legend>
          <p className="caption text-text-muted">{t("manualCard.form.billsHint")}</p>
          {error("bills") && <Banner tone="danger">{error("bills")}</Banner>}
          {months.map((month) => (
            <MoneyInput key={month} label={monthLabel(month, locale)} value={bills[month] ?? null} onValueChange={(cents) => setBills((b) => ({ ...b, [month]: cents }))} locale={locale} />
          ))}
        </fieldset>
        <Input
          label={t("manualCard.form.pix")}
          hint={t("manualCard.form.pixHint")}
          value={pix}
          onChange={(e) => setPix(e.target.value)}
          error={error("pixRecipient")}
          autoComplete="off"
          maxLength={120}
          disabled={busy !== null}
        />
        {failed && <Banner tone="danger">{t("manualCard.failed")}</Banner>}
      </form>
    </Sheet>
  );
}

import { CircleAlert } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useI18n } from "../../../shared/i18n";
import { AppDialog } from "../../../shared/ui/AppDialog";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { FormError } from "../../../shared/ui/FormError";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";
import type { Bill, BillInput } from "../api/api";
import type { BillOutcome } from "../hooks/useBills";
import { billInputOf } from "../logic/billForm";
import { billFieldErrorKey } from "../logic/fieldErrors";
import { centsToInput } from "../logic/money";

/** Adds a Bill, or edits `bill`. Field problems show beside their fields; a failed save stays open to retry. */
export function BillFormDialog({
  bill,
  save,
  onClose,
}: {
  bill: Bill | null;
  save(input: BillInput): Promise<BillOutcome>;
  onClose(): void;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const { run } = useSubmitOnce(async (form: HTMLFormElement) => {
    const data = new FormData(form);
    const result = billInputOf(
      { name: String(data.get("name") ?? ""), amount: String(data.get("expectedCents") ?? ""), dueDay: String(data.get("dueDay") ?? "") },
      locale,
    );
    setFailed(false);
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    setSaving(true);
    const outcome = await save(result.input);
    setSaving(false);
    if (outcome.kind === "ok") onClose();
    else if (outcome.kind === "fields") setErrors(outcome.fields);
    else setFailed(true);
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(event.currentTarget);
  }

  const field = (name: string, label: string, control: (props: object) => ReactNode, hint?: string) => {
    const error = errors[name];
    const errorId = `${id}-${name}-error`;
    const hintId = `${id}-${name}-hint`;
    const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;
    return (
      <div>
        <label htmlFor={`${id}-${name}`} className="mt-0">
          {label}
        </label>
        {control({ id: `${id}-${name}`, name, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, disabled: saving })}
        {hint && (
          <p id={hintId} className="mb-0 mt-1 text-sm text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="mb-0 mt-1 flex items-start gap-2 font-semibold text-danger">
            <CircleAlert aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
            <span>{t(billFieldErrorKey(name, error))}</span>
          </p>
        )}
      </div>
    );
  };

  const formId = `${id}-form`;
  return (
    <AppDialog
      size="sheet"
      title={t(bill ? "finances.bills.form.editTitle" : "finances.bills.form.addTitle")}
      onDismiss={onClose}
      dismissible={!saving}
      footer={
        <ButtonRow
          start={
            <Button variant="secondary" disabled={saving} onClick={onClose}>
              {t("finances.bills.form.cancel")}
            </Button>
          }
          end={
            <Button type="submit" form={formId} pending={saving}>
              {t("finances.bills.form.save")}
            </Button>
          }
        />
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        {field("name", t("finances.bills.form.name"), (p) => (
          <input {...p} type="text" defaultValue={bill?.name ?? ""} autoComplete="off" maxLength={120} />
        ))}
        {field("expectedCents", t("finances.bills.form.amount"), (p) => (
          <input {...p} type="text" inputMode="decimal" defaultValue={bill ? centsToInput(bill.expectedCents, locale) : ""} autoComplete="off" />
        ))}
        {field(
          "dueDay",
          t("finances.bills.form.dueDay"),
          (p) => <input {...p} type="number" inputMode="numeric" min={1} max={31} step={1} defaultValue={bill?.dueDay ?? ""} />,
          t("finances.bills.form.dueDayHint"),
        )}
        <FormError form="finances-bill">{failed && t("finances.bills.failed")}</FormError>
      </form>
    </AppDialog>
  );
}

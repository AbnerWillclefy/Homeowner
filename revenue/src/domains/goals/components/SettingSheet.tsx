import { Banner, Button, Sheet } from "@homeowner/bedrock";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { SaveOutcome } from "../hooks/useSavings";
import { goalFieldErrorKey } from "../logic/savings";

interface Props {
  title: string;
  subtitle?: string;
  /** Reads the form and writes it. A refused value comes back as `fields`, a failed write as `failed`; both leave the form as typed. */
  submit(): Promise<SaveOutcome>;
  /** Clears the setting; shows Clear next to Save. */
  clear?(): Promise<SaveOutcome>;
  /** Under the fields: a destructive action that stands alone. */
  below?: ReactNode;
  onClose(): void;
  children(error: (field: string) => string | undefined, saving: boolean): ReactNode;
}

/** A form in a Sheet for one Goal or setting. Field problems show beside their fields; a failed write stays open to try again. */
export function SettingSheet({ title, subtitle, submit, clear, below, onClose, children }: Props) {
  const { t } = useI18n();
  const formId = useId();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<"save" | "clear" | null>(null);

  async function run(write: () => Promise<SaveOutcome>, as: "save" | "clear") {
    if (busy) return;
    setFailed(false);
    setBusy(as);
    const outcome = await write();
    setBusy(null);
    if (outcome.kind === "ok") return onClose();
    setErrors(outcome.kind === "fields" ? outcome.fields : {});
    setFailed(outcome.kind === "failed");
  }

  const error = (field: string) => (errors[field] ? t(goalFieldErrorKey(field, errors[field])) : undefined);
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(submit, "save");
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title={title}
      subtitle={subtitle}
      closeLabel={t("app.close")}
      footer={
        <div className="flex gap-2">
          {clear && (
            <Button variant="secondary" loading={busy === "clear"} disabled={busy === "save"} onClick={() => void run(clear, "clear")}>
              {t("goals.form.clear")}
            </Button>
          )}
          <Button type="submit" form={formId} loading={busy === "save"} disabled={busy === "clear"} className="flex-1">
            {t("goals.form.save")}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {children(error, busy !== null)}
        {below}
        {failed && <Banner tone="danger">{t("goals.failed")}</Banner>}
      </form>
    </Sheet>
  );
}

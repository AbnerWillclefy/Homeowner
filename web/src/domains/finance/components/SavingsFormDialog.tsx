import { CircleAlert } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { useI18n } from "../../../shared/i18n";
import { AppDialog } from "../../../shared/ui/AppDialog";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { FormError } from "../../../shared/ui/FormError";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";
import type { SavingsOutcome } from "../hooks/useSavings";
import { savingsFieldErrorKey } from "../logic/savings";

/** Draws one labelled control with its hint and the message for its error code. */
export type FieldFn = (name: string, label: string, control: (props: object) => ReactNode, hint?: string) => ReactNode;

interface Props {
  title: string;
  /** One line under the title saying what the form is for. */
  intro?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Reads the form and writes it. A refused value comes back as `fields`, a failed write as `failed`; both leave the form as typed. */
  save(data: FormData): Promise<SavingsOutcome>;
  /** Clears the setting; shows Clear next to Cancel. True when it stuck. */
  clear?(): Promise<boolean>;
  /** Under the buttons, behind a hairline: a destructive action that stands alone. */
  below?: ReactNode;
  onClose(): void;
  children(field: FieldFn, saving: boolean): ReactNode;
}

/**
 * A dialog form for the savings screens. Field problems show beside their fields; a failed write keeps what was
 * typed and says so, and Save tries again.
 */
export function SavingsFormDialog({ title, intro, returnFocusRef, save, clear, below, onClose, children }: Props) {
  const { t } = useI18n();
  const id = useId();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<"save" | "clear" | null>(null);
  const saving = busy !== null;

  const { run } = useSubmitOnce(async (form: HTMLFormElement) => {
    setFailed(false);
    setBusy("save");
    const outcome = await save(new FormData(form));
    setBusy(null);
    if (outcome.kind === "ok") return onClose();
    setErrors(outcome.kind === "fields" ? outcome.fields : {});
    setFailed(outcome.kind === "failed");
  });
  const { run: runClear } = useSubmitOnce(async () => {
    setFailed(false);
    setBusy("clear");
    const ok = (await clear?.()) ?? false;
    setBusy(null);
    if (ok) onClose();
    else setFailed(true);
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(event.currentTarget);
  }

  const field: FieldFn = (name, label, control, hint) => {
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
            <span>{t(savingsFieldErrorKey(name, error))}</span>
          </p>
        )}
      </div>
    );
  };

  const formId = `${id}-form`;
  return (
    <AppDialog
      size="sheet"
      title={title}
      description={intro ? <p className="mb-0 text-muted">{intro}</p> : undefined}
      onDismiss={onClose}
      dismissible={!saving}
      returnFocusRef={returnFocusRef}
      footer={
        <div className="w-full">
          <ButtonRow
            start={
              <>
                <Button variant="secondary" disabled={saving} onClick={onClose}>
                  {t("finances.savings.cancel")}
                </Button>
                {clear && (
                  <Button variant="secondary" disabled={saving} pending={busy === "clear"} onClick={() => void runClear()}>
                    {t("finances.savings.clear")}
                  </Button>
                )}
              </>
            }
            end={
              <Button type="submit" form={formId} disabled={saving} pending={busy === "save"}>
                {t("finances.savings.save")}
              </Button>
            }
          />
          {below && <div className="mt-3 flex border-t border-border pt-3">{below}</div>}
        </div>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        {children(field, saving)}
        <FormError form={id}>{failed && t("finances.savings.saveFailed")}</FormError>
      </form>
    </AppDialog>
  );
}

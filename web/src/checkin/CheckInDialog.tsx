import { useId, useState, type FormEvent } from "react";
import { LEVELS, type CheckIn, type Level } from "../api/checkIn";
import { AppDialog } from "../components/ui/AppDialog";
import { useSubmitOnce } from "../components/ui/useSubmitOnce";
import { useToast } from "../components/ui/useToast";
import { useI18n } from "../i18n";
import { demandLabel, labelText } from "../profile/labels";
import { Button } from "../shared/ui/Button";
import { SAVE_FAILURE_KEY } from "./failureMessages";
import { formFrom, submission, toggledRestriction, type CheckInFormState } from "./form";
import { LEVEL_KEYS } from "./labels";
import type { SaveFailure } from "./state";

const CHECK = "size-5 w-5 min-h-0 mt-0 shrink-0 accent-accent";
const CHOICE = "flex items-start gap-3 min-h-11 mt-0 font-normal";

/**
 * The Check-in form in a near-full-height dialog. Submit and Cancel are pinned in the footer so they stay
 * reachable with the on-screen keyboard open. Escape and a tap outside close it, except while saving. A saved
 * Check-in closes the dialog and shows a toast; a failed save keeps it open with the reason, to retry.
 */
export function CheckInDialog({
  checkIn,
  demands,
  save: saveCheckIn,
  onClose,
}: {
  checkIn: CheckIn;
  demands: readonly string[];
  /** Resolves to null once saved, else why it was not. */
  save(level: Level, restrictions: readonly string[]): Promise<SaveFailure | null>;
  onClose(): void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const formId = useId();
  const idPrefix = useId();
  const [form, setForm] = useState<CheckInFormState>(() => formFrom(checkIn));
  const [levelMissing, setLevelMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null);

  // The guard covers a second Enter in the same tick, which the async `saving` state does not.
  const { run: save } = useSubmitOnce(async (level: Level, restrictions: readonly string[]) => {
    setSaving(true);
    setSaveFailure(null);
    const failure = await saveCheckIn(level, restrictions);
    if (failure === null) {
      toast.show({ messageKey: "checkin.saved", tone: "success" });
      onClose();
      return;
    }
    setSaving(false);
    setSaveFailure(failure);
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = submission(form, demands);
    if (!result.ok) return setLevelMissing(true);
    setLevelMissing(false);
    void save(result.level, result.restrictions);
  }

  function chooseLevel(level: Level) {
    setLevelMissing(false);
    setForm((current) => ({ ...current, level }));
  }

  return (
    <AppDialog
      size="sheet"
      title={t("checkin.heading")}
      onDismiss={onClose}
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            {t("checkin.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={saving} aria-busy={saving}>
            {saving ? t("checkin.saving") : t("checkin.submit")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate>
        <fieldset
          className="p-0 border-0"
          disabled={saving}
          aria-describedby={levelMissing ? `${idPrefix}-level-error` : undefined}
        >
          <legend className="font-semibold">{t("checkin.level.legend")}</legend>
          {LEVELS.map((level) => {
            const keys = LEVEL_KEYS[level];
            return (
              <label key={level} className={CHOICE}>
                <input
                  type="radio"
                  name={`${idPrefix}-level`}
                  className={CHECK}
                  checked={form.level === level}
                  onChange={() => chooseLevel(level)}
                />
                <span>
                  <span className="font-semibold">{t(keys.label)}</span>
                  {"hint" in keys && <span className="block text-muted">{t(keys.hint)}</span>}
                </span>
              </label>
            );
          })}
          {levelMissing && (
            <p id={`${idPrefix}-level-error`} role="alert" className="text-danger">
              {t("checkin.level.required")}
            </p>
          )}
        </fieldset>

        {demands.length > 0 && (
          <fieldset className="mt-4 p-0 border-0" disabled={saving}>
            <legend className="font-semibold">{t("checkin.restrictions.legend")}</legend>
            {demands.map((id) => (
              <label key={id} className={CHOICE}>
                <input
                  type="checkbox"
                  className={CHECK}
                  checked={form.restrictions.includes(id)}
                  onChange={() =>
                    setForm((current) => ({ ...current, restrictions: toggledRestriction(current.restrictions, id) }))
                  }
                />
                {labelText(t, demandLabel(id))}
              </label>
            ))}
          </fieldset>
        )}

        {saveFailure && (
          <p role="alert" className="text-danger">
            {t(SAVE_FAILURE_KEY[saveFailure])}
          </p>
        )}
      </form>
    </AppDialog>
  );
}

import { Button, Checkbox, Choice, ChoiceGroup, Sheet } from "@homeowner/bedrock";
import { EnergyBars } from "@homeowner/bedrock/home";
import { useId, useState, type FormEvent, type RefObject } from "react";
import { LEVELS, type CheckIn, type Level } from "../api/api";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";
import { useToast } from "../../../shared/ui/useToast";
import { useI18n } from "../../../shared/i18n";
import { demandLabel, labelText } from "../../profile/logic/labels";
import { SAVE_FAILURE_KEY } from "../logic/failureMessages";
import { formFrom, submission, toggledRestriction, type CheckInFormState } from "../logic/form";
import { LEVEL_BARS, LEVEL_KEYS } from "../logic/labels";
import type { SaveFailure } from "../logic/state";

const LEGEND = "label p-0 pb-2 text-text-muted";

/**
 * The Check-in form in a tall Sheet. Save is pinned in the footer so it stays reachable with the on-screen keyboard
 * open. The ✕, Escape and a drag close it, except while saving. A saved Check-in closes the Sheet and shows a
 * toast; a failed save keeps it open with the reason, to retry.
 */
export function CheckInDialog({
  checkIn,
  demands,
  save: saveCheckIn,
  onClose,
  returnFocusRef,
  initialLevel = null,
}: {
  checkIn: CheckIn;
  /** A level the Resident already picked on Today's hero card: the form opens with it ticked, and still asks for Restrictions. */
  initialLevel?: Level | null;
  demands: readonly string[];
  /** Resolves to null once saved, else why it was not. */
  save(level: Level, restrictions: readonly string[]): Promise<SaveFailure | null>;
  onClose(): void;
  /** The control that opened the Sheet, which gets focus back on close. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const formId = useId();
  const idPrefix = useId();
  const [form, setForm] = useState<CheckInFormState>(() => formFrom(checkIn, initialLevel));
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
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      size="full"
      title={t("checkin.heading")}
      subtitle={t("checkin.subtitle")}
      closeLabel={t("checkin.close")}
      dismissible={!saving}
      returnFocusRef={returnFocusRef}
      footer={
        <Button type="submit" form={formId} size="lg" loading={saving}>
          {t("checkin.submit")}
        </Button>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-6 pb-4">
        <fieldset className="m-0 min-w-0 border-0 p-0" disabled={saving} aria-describedby={levelMissing ? `${idPrefix}-level-error` : undefined}>
          <legend className={LEGEND}>{t("checkin.level.legend")}</legend>
          <ChoiceGroup label={t("checkin.level.legend")} value={form.level ?? undefined} onValueChange={(level) => chooseLevel(level as Level)}>
            {LEVELS.map((level) => (
              <Choice
                key={level}
                value={level}
                label={t(LEVEL_KEYS[level].label)}
                hint={t(LEVEL_KEYS[level].hint)}
                leading={<EnergyBars level={LEVEL_BARS[level]} />}
              />
            ))}
          </ChoiceGroup>
          {levelMissing && (
            <p id={`${idPrefix}-level-error`} role="alert" className="mt-2 mb-0 text-danger">
              {t("checkin.level.required")}
            </p>
          )}
        </fieldset>

        {demands.length > 0 && (
          <fieldset className="m-0 min-w-0 border-0 p-0" disabled={saving}>
            <legend className={LEGEND}>{t("checkin.restrictions.legend")}</legend>
            {demands.map((id) => (
              <Checkbox
                key={id}
                label={labelText(t, demandLabel(id))}
                checked={form.restrictions.includes(id)}
                onCheckedChange={() => setForm((current) => ({ ...current, restrictions: toggledRestriction(current.restrictions, id) }))}
              />
            ))}
            <span className="caption text-text-muted">{t("checkin.restrictions.hint")}</span>
          </fieldset>
        )}

        {saveFailure && (
          <p role="alert" className="my-0 text-danger">
            {t(SAVE_FAILURE_KEY[saveFailure])}
          </p>
        )}
      </form>
    </Sheet>
  );
}

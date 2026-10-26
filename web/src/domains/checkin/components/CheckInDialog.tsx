import { BatteryFull, BatteryLow, BatteryMedium, Moon, type LucideIcon } from "lucide-react";
import { useId, useState, type FormEvent, type RefObject } from "react";
import { LEVELS, type CheckIn, type Level } from "../api/api";
import { AppDialog } from "../../../shared/ui/AppDialog";
import { useSubmitOnce } from "../../../shared/ui/useSubmitOnce";
import { useToast } from "../../../shared/ui/useToast";
import { useI18n } from "../../../shared/i18n";
import { demandLabel, labelText } from "../../profile/logic/labels";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { SAVE_FAILURE_KEY } from "../logic/failureMessages";
import { formFrom, submission, toggledRestriction, type CheckInFormState } from "../logic/form";
import { LEVEL_KEYS } from "../logic/labels";
import { RADIO_CARD } from "../../../shared/ui/radioCard";
import type { SaveFailure } from "../logic/state";

// Rest, then a battery filling up. Decoration only: the level's name is always written next to it.
const LEVEL_ICONS: Record<Level, LucideIcon> = {
  drained: Moon,
  low: BatteryLow,
  normal: BatteryMedium,
  energized: BatteryFull,
};

// A Restriction drawn as a pill around a hidden checkbox, as in the Home questionnaire.
const CHIP =
  "relative mt-0 flex min-h-11 cursor-pointer items-center justify-center rounded-pill border border-border bg-surface-raised px-4 text-center font-semibold has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-accent-contrast has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:disabled]:cursor-not-allowed has-[:disabled]:border-dashed";

const LEGEND = "p-0 text-lg font-semibold";

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
  returnFocusRef,
}: {
  checkIn: CheckIn;
  demands: readonly string[];
  /** Resolves to null once saved, else why it was not. */
  save(level: Level, restrictions: readonly string[]): Promise<SaveFailure | null>;
  onClose(): void;
  /** The control that opened the dialog, which gets focus back on close. */
  returnFocusRef?: RefObject<HTMLElement | null>;
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
      returnFocusRef={returnFocusRef}
      footer={
        <ButtonRow
          start={
            <Button variant="secondary" disabled={saving} onClick={onClose}>
              {t("checkin.cancel")}
            </Button>
          }
          end={
            <Button type="submit" form={formId} pending={saving}>
              {t("checkin.submit")}
            </Button>
          }
        />
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
        <fieldset
          className="m-0 min-w-0 border-0 p-0"
          disabled={saving}
          aria-describedby={levelMissing ? `${idPrefix}-level-error` : undefined}
        >
          <legend className={LEGEND}>{t("checkin.level.legend")}</legend>
          <div className="mt-3 flex flex-col gap-2">
            {LEVELS.map((level) => {
              const keys = LEVEL_KEYS[level];
              const Icon = LEVEL_ICONS[level];
              return (
                <label key={level} className={`group ${RADIO_CARD}`}>
                  <input
                    type="radio"
                    name={`${idPrefix}-level`}
                    className="sr-only"
                    checked={form.level === level}
                    onChange={() => chooseLevel(level)}
                  />
                  <Icon aria-hidden="true" size={24} className="shrink-0 text-accent group-has-[:checked]:text-current" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="block">{t(keys.label)}</span>
                    {"hint" in keys && <span className="block text-sm font-normal">{t(keys.hint)}</span>}
                  </span>
                </label>
              );
            })}
          </div>
          {levelMissing && (
            <p id={`${idPrefix}-level-error`} role="alert" className="mt-2 mb-0 text-danger">
              {t("checkin.level.required")}
            </p>
          )}
        </fieldset>

        {demands.length > 0 && (
          <fieldset className="m-0 min-w-0 border-0 p-0" disabled={saving}>
            <legend className={LEGEND}>{t("checkin.restrictions.legend")}</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {demands.map((id) => (
                <label key={id} className={CHIP}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={form.restrictions.includes(id)}
                    onChange={() =>
                      setForm((current) => ({ ...current, restrictions: toggledRestriction(current.restrictions, id) }))
                    }
                  />
                  {labelText(t, demandLabel(id))}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {saveFailure && (
          <p role="alert" className="my-0 text-danger">
            {t(SAVE_FAILURE_KEY[saveFailure])}
          </p>
        )}
      </form>
    </AppDialog>
  );
}

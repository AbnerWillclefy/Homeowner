import { useId, useState, type FormEvent } from "react";
import { LEVELS, type Level } from "../api/checkIn";
import { useI18n } from "../i18n";
import { demandLabel } from "../profile/labels";
import { SAVE_FAILURE_KEY, LOAD_FAILURE_KEY } from "./failureMessages";
import { emptyForm, formFrom, submission, toggledRestriction, type CheckInFormState } from "./form";
import { LEVEL_KEYS } from "./labels";
import { checkInView } from "./state";
import type { useCheckIn } from "./useCheckIn";

const CHECK = "size-5 w-5 min-h-0 mt-0 shrink-0 accent-accent";
const CHOICE = "flex items-start gap-3 min-h-11 mt-0 font-normal";

type Controller = ReturnType<typeof useCheckIn>;

/**
 * Today's Check-in. When it is missing it asks inline (not a modal, so the app stays usable) every time the
 * app opens; once answered it shrinks to a line with a Change button. Rendered inside the Home section.
 */
export function CheckInSection({ checkIn }: { checkIn: Controller }) {
  const { t } = useI18n();
  const { state } = checkIn;
  const view = checkInView(state);

  return (
    <section aria-labelledby="checkin-heading">
      <h2 id="checkin-heading">{t("checkin.heading")}</h2>

      {view === "loading" && <p role="status">{t("checkin.loading")}</p>}

      {state.kind === "failed" && (
        <>
          <p role="alert" className="text-danger">
            {t(LOAD_FAILURE_KEY[state.reason])}
          </p>
          {state.reason !== "not-signed-in" && (
            <button type="button" className="btn" onClick={checkIn.reload}>
              {t("checkin.retry")}
            </button>
          )}
        </>
      )}

      {state.kind === "ready" && (
        <>
          {/* Always present, so the result is announced when it appears. */}
          <div role="status">{state.saved && <p>{t("checkin.saved")}</p>}</div>

          {view === "summary" ? (
            <Summary checkIn={checkIn} />
          ) : (
            <CheckInForm
              // A fresh form each time one opens, starting from what is saved (nothing when it is missing).
              key={view}
              checkIn={checkIn}
              prompt={view === "prompt"}
            />
          )}
        </>
      )}
    </section>
  );
}

function Summary({ checkIn }: { checkIn: Controller }) {
  const { t } = useI18n();
  if (checkIn.state.kind !== "ready" || checkIn.state.checkIn.level === null) return null;
  const { level, restrictions } = checkIn.state.checkIn;
  return (
    <>
      <p>{t("checkin.summary", { level: t(LEVEL_KEYS[level].label) })}</p>
      {restrictions.length > 0 && (
        <p>
          {t("checkin.summary.restrictions", {
            demands: restrictions
              .map((id) => {
                const label = demandLabel(id);
                return "key" in label ? t(label.key) : label.text;
              })
              .join(", "),
          })}
        </p>
      )}
      <button type="button" className="btn" onClick={checkIn.edit}>
        {t("checkin.change")}
      </button>
    </>
  );
}

function CheckInForm({ checkIn, prompt }: { checkIn: Controller; prompt: boolean }) {
  const { t } = useI18n();
  const idPrefix = useId();
  const { state, demands } = checkIn;
  const [form, setForm] = useState<CheckInFormState>(() =>
    state.kind === "ready" ? formFrom(state.checkIn) : emptyForm(),
  );
  const [levelMissing, setLevelMissing] = useState(false);
  if (state.kind !== "ready") return null;
  const { saving, saveFailure } = state;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = submission(form, demands);
    if (!result.ok) return setLevelMissing(true);
    setLevelMissing(false);
    void checkIn.save(result.level, result.restrictions);
  }

  function chooseLevel(level: Level) {
    setLevelMissing(false);
    setForm((current) => ({ ...current, level }));
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {prompt && <p>{t("checkin.intro")}</p>}

      <fieldset className="mt-4 p-0 border-0" disabled={saving} aria-describedby={levelMissing ? `${idPrefix}-level-error` : undefined}>
        <legend className="font-semibold">{t("checkin.level.legend")}</legend>
        {LEVELS.map((level) => (
          <label key={level} className={CHOICE}>
            <input
              type="radio"
              name={`${idPrefix}-level`}
              className={CHECK}
              checked={form.level === level}
              onChange={() => chooseLevel(level)}
            />
            <span>
              <span className="font-semibold">{t(LEVEL_KEYS[level].label)}</span>
              <span className="block text-muted">{t(LEVEL_KEYS[level].hint)}</span>
            </span>
          </label>
        ))}
        {levelMissing && (
          <p id={`${idPrefix}-level-error`} role="alert" className="text-danger">
            {t("checkin.level.required")}
          </p>
        )}
      </fieldset>

      {demands.length > 0 && (
        <fieldset className="mt-4 p-0 border-0" disabled={saving} aria-describedby={`${idPrefix}-restrictions-hint`}>
          <legend className="font-semibold">{t("checkin.restrictions.legend")}</legend>
          <p id={`${idPrefix}-restrictions-hint`} className="text-muted">
            {t("checkin.restrictions.hint")}
          </p>
          {demands.map((id) => {
            const label = demandLabel(id);
            return (
              <label key={id} className={CHOICE}>
                <input
                  type="checkbox"
                  className={CHECK}
                  checked={form.restrictions.includes(id)}
                  onChange={() => setForm((current) => ({ ...current, restrictions: toggledRestriction(current.restrictions, id) }))}
                />
                {"key" in label ? t(label.key) : label.text}
              </label>
            );
          })}
        </fieldset>
      )}

      {saveFailure && (
        <p role="alert" className="text-danger">
          {t(SAVE_FAILURE_KEY[saveFailure])}
        </p>
      )}

      <div className="flex flex-wrap gap-3 mt-4">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t("checkin.saving") : t("checkin.submit")}
        </button>
        {!prompt && (
          <button type="button" className="btn" disabled={saving} onClick={checkIn.cancel}>
            {t("checkin.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}

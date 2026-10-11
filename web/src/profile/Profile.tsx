import { useState } from "react";
import { PREFERENCES, type Preference, type Profile as ProfileData, type Weekday } from "../api/profile";
import { useI18n, type MessageKey } from "../i18n";
import { MAX_BASELINE, parseBaselineInput } from "./baselineInput";
import { categoryLabel, demandLabel, type Label } from "./labels";
import { DISPLAY_WEEKDAYS, weekdayLabel } from "./weekdays";
import { useProfile, type ProfileProblem } from "./useProfile";

const PROBLEM_KEY: Record<ProfileProblem, MessageKey> = {
  offline: "profile.offline",
  error: "profile.error",
  "not-signed-in": "profile.notSignedIn",
};

const SAVE_FAILED_KEY: Record<ProfileProblem, MessageKey> = {
  offline: "profile.saveFailed",
  error: "profile.saveFailed",
  "not-signed-in": "profile.saveFailed.notSignedIn",
};

const PREFERENCE_KEY: Record<Preference, MessageKey> = {
  like: "profile.preference.like",
  neutral: "profile.preference.neutral",
  dislike: "profile.preference.dislike",
};

/**
 * The signed-in User's Baseline, Preferences and Restrictions. Each control saves on its own: the change
 * shows at once and is undone with a visible message if the API refuses it. Baseline saves on blur.
 */
export function Profile() {
  const { t } = useI18n();
  const { state, save, retry, setBaseline, setPreference, setRestricted } = useProfile();

  const text = (label: Label) => ("key" in label ? t(label.key) : label.text);

  return (
    <section aria-labelledby="profile-heading">
      <h2 id="profile-heading">{t("profile.heading")}</h2>

      {state.kind === "loading" && <p role="status">{t("profile.loading")}</p>}

      {state.kind === "problem" && (
        <>
          <p role="alert">{t(PROBLEM_KEY[state.problem])}</p>
          {state.problem !== "not-signed-in" && (
            <button type="button" className="btn" onClick={retry}>
              {t("profile.retry")}
            </button>
          )}
        </>
      )}

      {state.kind === "ready" && (
        <>
          <p>{t("profile.intro")}</p>

          {/* One live region for every control, so each save or undo is announced once. */}
          <p role={save.kind === "failed" ? "alert" : "status"}>
            {save.kind === "saved" && t("profile.saved")}
            {save.kind === "failed" && t(SAVE_FAILED_KEY[save.problem])}
          </p>

          <section aria-labelledby="profile-baseline-heading">
            <h3 id="profile-baseline-heading">{t("profile.baseline.heading")}</h3>
            <p>{t("profile.baseline.explain")}</p>
            <p id="profile-baseline-hint">{t("profile.baseline.hint")}</p>
            {DISPLAY_WEEKDAYS.map((day) => (
              <BaselineRow key={day} day={day} saved={state.profile.baseline[day]} onSave={setBaseline} />
            ))}
          </section>

          <section aria-labelledby="profile-preferences-heading">
            <h3 id="profile-preferences-heading">{t("profile.preferences.heading")}</h3>
            <p>{t("profile.preferences.intro")}</p>
            {state.categories.map((id) => (
              <PreferenceChoice
                key={id}
                id={id}
                name={text(categoryLabel(id))}
                profile={state.profile}
                onChange={setPreference}
              />
            ))}
          </section>

          <section aria-labelledby="profile-restrictions-heading">
            <h3 id="profile-restrictions-heading">{t("profile.restrictions.heading")}</h3>
            <p>{t("profile.restrictions.intro")}</p>
            {state.demands.map((id) => (
              <label key={id} className="flex items-center gap-3 min-h-11 font-normal">
                <input
                  type="checkbox"
                  className="size-5 w-5 min-h-0 mt-0 shrink-0 accent-accent"
                  checked={state.profile.restrictions.includes(id)}
                  onChange={(event) => setRestricted(id, event.target.checked)}
                />
                {text(demandLabel(id))}
              </label>
            ))}
          </section>
        </>
      )}
    </section>
  );
}

function BaselineRow({
  day,
  saved,
  onSave,
}: {
  day: Weekday;
  saved: number | null;
  onSave(day: Weekday, points: number | null): void;
}) {
  const { t, locale } = useI18n();
  // null while the field is not being edited, so it always shows the saved value, rollbacks included.
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const id = `profile-baseline-${day}`;

  function commit(raw: string) {
    const parsed = parseBaselineInput(raw);
    if (parsed.kind === "invalid") return setInvalid(true);
    setInvalid(false);
    setDraft(null);
    onSave(day, parsed.kind === "set" ? parsed.points : null);
  }

  return (
    <div>
      <label htmlFor={id}>{weekdayLabel(day, locale)}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_BASELINE}
        step={1}
        value={draft ?? (saved === null ? "" : String(saved))}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error profile-baseline-hint` : "profile-baseline-hint"}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {invalid && (
        <p id={`${id}-error`} role="alert">
          {t("profile.baseline.invalid")}
        </p>
      )}
    </div>
  );
}

function PreferenceChoice({
  id,
  name,
  profile,
  onChange,
}: {
  id: string;
  name: string;
  profile: ProfileData;
  onChange(category: string, preference: Preference): void;
}) {
  const { t } = useI18n();
  const current = profile.preferences[id] ?? "neutral";

  return (
    <fieldset className="mt-4 p-0 border-0">
      <legend className="font-semibold">{name}</legend>
      <div className="flex flex-wrap gap-x-4">
        {PREFERENCES.map((value) => (
          <label key={value} className="flex items-center gap-2 min-h-11 mt-0 font-normal">
            <input
              type="radio"
              name={`profile-preference-${id}`}
              className="size-5 w-5 min-h-0 mt-0 shrink-0 accent-accent"
              checked={current === value}
              onChange={() => onChange(id, value)}
            />
            {t(PREFERENCE_KEY[value])}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

import { useState } from "react";
import { PREFERENCES, type Baseline, type Preference, type Profile as ProfileData, type Weekday } from "../api/profile";
import { categoryStyle } from "../components/ui/categoryStyle";
import { useI18n, type MessageKey } from "../i18n";
import { MAX_BASELINE, parseBaselineInput } from "./baselineInput";
import { categoryLabel, demandLabel, labelText } from "./labels";
import type { ProfileProblem, ProfileState, SaveState } from "./useProfile";
import { DISPLAY_WEEKDAYS, weekdayLabel } from "./weekdays";

// The three parts of Me (Baseline, Preferences, Restrictions), as bodies without a heading. The Me tab and each onboarding
// step wrap them in their own heading, and both feed them from one useProfile() call.

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

/** Loading and failure while the Profile is not ready, and one live region for every save or undo once it is. */
export function ProfileStatus({ state, save, retry }: { state: ProfileState; save: SaveState; retry(): void }) {
  const { t } = useI18n();
  if (state.kind === "loading") return <p role="status">{t("profile.loading")}</p>;
  if (state.kind === "problem") {
    return (
      <>
        <p role="alert">{t(PROBLEM_KEY[state.problem])}</p>
        {state.problem !== "not-signed-in" && (
          <button type="button" className="btn" onClick={retry}>
            {t("profile.retry")}
          </button>
        )}
      </>
    );
  }
  return (
    <p role={save.kind === "failed" ? "alert" : "status"}>
      {save.kind === "saved" && t("profile.saved")}
      {save.kind === "failed" && t(SAVE_FAILED_KEY[save.problem])}
    </p>
  );
}

export function BaselineFields({
  baseline,
  onSave,
}: {
  baseline: Baseline;
  onSave(day: Weekday, points: number | null): void;
}) {
  const { t } = useI18n();
  return (
    <>
      <p>{t("profile.baseline.explain")}</p>
      <p id="profile-baseline-hint">{t("profile.baseline.hint")}</p>
      {DISPLAY_WEEKDAYS.map((day) => (
        <BaselineRow key={day} day={day} saved={baseline[day]} onSave={onSave} />
      ))}
    </>
  );
}

export function PreferenceFields({
  profile,
  categories,
  onChange,
}: {
  profile: ProfileData;
  categories: readonly string[];
  onChange(category: string, preference: Preference): void;
}) {
  const { t } = useI18n();
  return (
    <>
      <p>{t("profile.preferences.intro")}</p>
      {categories.map((id) => (
        <PreferenceChoice key={id} id={id} name={labelText(t, categoryLabel(id))} profile={profile} onChange={onChange} />
      ))}
    </>
  );
}

export function RestrictionFields({
  restrictions,
  demands,
  onChange,
}: {
  restrictions: readonly string[];
  demands: readonly string[];
  onChange(demand: string, restricted: boolean): void;
}) {
  const { t } = useI18n();
  return (
    <>
      <p>{t("profile.restrictions.intro")}</p>
      {demands.map((id) => (
        <label key={id} className="flex items-center gap-3 min-h-11 font-normal">
          <input
            type="checkbox"
            className="size-5 w-5 min-h-0 mt-0 shrink-0 accent-accent"
            checked={restrictions.includes(id)}
            onChange={(event) => onChange(id, event.target.checked)}
          />
          {labelText(t, demandLabel(id))}
        </label>
      ))}
    </>
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
  const { fill, ink, icon: Icon } = categoryStyle(id);

  // The Category's pastel and icon sit around the fieldset; the name stays as text in the legend.
  return (
    <fieldset className={`mt-4 mx-0 mb-0 box-border rounded-card border border-border p-3 ${fill} ${ink}`}>
      <legend className="px-1 font-semibold [overflow-wrap:anywhere]">
        <span className="inline-flex items-center gap-2">
          <Icon aria-hidden="true" size={16} className="shrink-0" />
          {name}
        </span>
      </legend>
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

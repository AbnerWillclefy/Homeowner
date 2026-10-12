import { PREFERENCES, type Baseline, type Preference, type Profile as ProfileData, type Weekday } from "../api/profile";
import { categoryStyle } from "../components/ui/categoryStyle";
import { useI18n, type MessageKey } from "../i18n";
import { Button } from "../shared/ui/Button";
import { BASELINE_LEVELS, levelLabelKey, levelToPoints, pointsToLevel } from "./baselineLevels";
import { categoryLabel, demandLabel, labelText } from "./labels";
import { preferenceCategories } from "./preferenceCategories";
import type { ProfileProblem, ProfileState } from "./useProfile";
import { DISPLAY_WEEKDAYS, weekdayLabel } from "./weekdays";

// The three parts of Me (Baseline, Preferences, Restrictions), as bodies without a heading. The Me tab and each onboarding
// step wrap them in their own heading, and both feed them from one useProfile() call.

const PROBLEM_KEY: Record<ProfileProblem, MessageKey> = {
  offline: "profile.offline",
  error: "profile.error",
  "not-signed-in": "profile.notSignedIn",
};

const PREFERENCE_KEY: Record<Preference, MessageKey> = {
  like: "profile.preference.like",
  neutral: "profile.preference.neutral",
  dislike: "profile.preference.dislike",
};

/**
 * Loading and failure while the Profile is not ready. Once it is, a save or an undo is a toast, so this shows
 * nothing. A load problem stays inline because it needs Retry.
 */
export function ProfileStatus({ state, retry }: { state: ProfileState; retry(): void }) {
  const { t } = useI18n();
  if (state.kind === "loading") return <p role="status">{t("profile.loading")}</p>;
  if (state.kind === "problem") {
    return (
      <>
        <p role="alert">{t(PROBLEM_KEY[state.problem])}</p>
        {state.problem !== "not-signed-in" && (
          <Button variant="secondary" onClick={retry}>
            {t("profile.retry")}
          </Button>
        )}
      </>
    );
  }
  return null;
}

export function BaselineFields({
  baseline,
  onSave,
}: {
  baseline: Baseline;
  onSave(day: Weekday, points: number | null): void;
}) {
  return (
    <>
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
  const shown = preferenceCategories(categories);
  return (
    <>
      {shown.map((id) => (
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
  // Derived from the saved points, so an old number shows as its nearest level without being rewritten, and a
  // rollback shows the previous level again. Nothing is selected for an unset day.
  const current = pointsToLevel(saved);

  return (
    <fieldset className="mt-4 mx-0 mb-0 box-border rounded-card border border-border p-3">
      <legend className="px-1 font-semibold [overflow-wrap:anywhere]">{weekdayLabel(day, locale)}</legend>
      <div className="flex flex-wrap gap-2">
        {BASELINE_LEVELS.map((level) => (
          <LevelPill
            key={level}
            name={`profile-baseline-${day}`}
            label={t(levelLabelKey(level))}
            checked={current === level}
            onPick={() => onSave(day, levelToPoints(level))}
          />
        ))}
      </div>
    </fieldset>
  );
}

function LevelPill({
  name,
  label,
  checked,
  onPick,
}: {
  name: string;
  label: string;
  checked: boolean;
  onPick(): void;
}) {
  return (
    <label className="relative mt-0 flex min-h-11 min-w-20 flex-1 cursor-pointer items-center justify-center rounded-card border border-border px-3 text-center font-normal has-[:checked]:bg-accent has-[:checked]:font-semibold has-[:checked]:text-accent-contrast has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus">
      <input type="radio" name={name} className="sr-only" checked={checked} onChange={onPick} />
      {label}
    </label>
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

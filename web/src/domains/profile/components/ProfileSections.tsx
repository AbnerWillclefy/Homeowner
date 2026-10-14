import { PREFERENCES, type Baseline, type Preference, type Profile as ProfileData, type Weekday } from "../api/api";
import { CategoryTile } from "../../chores/components/FactList";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { BASELINE_LEVELS, levelLabelKey, levelToPoints, pointsToLevel } from "../logic/baselineLevels";
import { categoryLabel, demandLabel, labelText } from "../logic/labels";
import { preferenceCategories } from "../logic/preferenceCategories";
import type { ProfileProblem, ProfileState } from "../hooks/useProfile";
import { DISPLAY_WEEKDAYS, weekdayLabel } from "../logic/weekdays";

// Rows split by a hairline, the same in every part.
const ROWS = "flex flex-col divide-y divide-border/30";

// A row of radio pills that reads as one segmented control.
const SEGMENTS = "flex gap-1 rounded-pill border border-border p-1";

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
    <div className={ROWS}>
      {DISPLAY_WEEKDAYS.map((day) => (
        <BaselineRow key={day} day={day} saved={baseline[day]} onSave={onSave} />
      ))}
    </div>
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
    <div className={ROWS}>
      {shown.map((id) => (
        <PreferenceChoice key={id} id={id} name={labelText(t, categoryLabel(id))} profile={profile} onChange={onChange} />
      ))}
    </div>
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
    <div className={ROWS}>
      {demands.map((id) => (
        <label key={id} className="my-0 flex min-h-11 items-center gap-3 py-1 font-semibold">
          <input
            type="checkbox"
            className="size-5 w-5 min-h-0 mt-0 shrink-0 accent-accent"
            checked={restrictions.includes(id)}
            onChange={(event) => onChange(id, event.target.checked)}
          />
          {labelText(t, demandLabel(id))}
        </label>
      ))}
    </div>
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

  const name = weekdayLabel(day, locale);

  // The legend names the group for screen readers; the visible name is a plain span, so the row can lay out
  // as a flex row (a rendered legend sits in the fieldset's border and cannot).
  return (
    <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-0 p-0 py-3">
      <legend className="sr-only">{name}</legend>
      <span aria-hidden="true" className="w-12 shrink-0 font-semibold first-letter:uppercase">
        {weekdayLabel(day, locale, "short")}
      </span>
      <div className={`${SEGMENTS} flex-1 basis-44`}>
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
    <label className="relative mt-0 flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-pill px-2 text-center font-semibold has-[:checked]:bg-accent has-[:checked]:font-semibold has-[:checked]:text-accent-contrast has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus">
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

  // As in the Baseline rows, the legend is for screen readers and the visible name is a span.
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0 py-3">
      <legend className="sr-only">{name}</legend>
      <span aria-hidden="true" className="flex items-center gap-3 font-semibold [overflow-wrap:anywhere]">
        <CategoryTile category={id} />
        {name}
      </span>
      <div className={SEGMENTS}>
        {PREFERENCES.map((value) => (
          <LevelPill
            key={value}
            name={`profile-preference-${id}`}
            label={t(PREFERENCE_KEY[value])}
            checked={current === value}
            onPick={() => onChange(id, value)}
          />
        ))}
      </div>
    </fieldset>
  );
}

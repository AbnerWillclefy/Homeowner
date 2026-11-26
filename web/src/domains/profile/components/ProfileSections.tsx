import { PREFERENCES, type Baseline, type Preference, type Profile as ProfileData, type Weekday } from "../api/api";
import { ChoreIcon } from "@homeowner/bedrock/home";
import { SegmentedControl, Switch } from "@homeowner/bedrock";
import { choreCategory } from "../../chores/logic/choreCategory";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { BASELINE_LEVELS, levelLabelKey, levelToPoints, pointsToLevel, type BaselineLevel } from "../logic/baselineLevels";
import { categoryLabel, demandLabel, labelText } from "../logic/labels";
import { preferenceCategories } from "../logic/preferenceCategories";
import type { ProfileProblem, ProfileState } from "../hooks/useProfile";
import { DISPLAY_WEEKDAYS, weekdayLabel } from "../logic/weekdays";

// Rows split by a hairline, the same in every part.
const ROWS = "flex flex-col divide-y divide-border/30";

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
 * A load problem with Retry, and nothing in any other state: the wait is announced by the caller (the page's
 * status, or the onboarding step), and once the Profile is ready a save or an undo is a toast. A load problem
 * stays inline because it needs Retry.
 */
export function ProfileStatus({ state, retry }: { state: ProfileState; retry(): void }) {
  const { t } = useI18n();
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
  return (
    <div className={ROWS}>
      {preferenceCategories(categories).map((id) => (
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
        <Switch
          key={id}
          label={labelText(t, demandLabel(id))}
          checked={restrictions.includes(id)}
          onCheckedChange={(checked) => onChange(id, checked)}
        />
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
  // rollback shows the previous level again. Nothing is selected for an unset day (value "").
  const current = pointsToLevel(saved);
  return (
    <div className="flex items-center gap-3 py-2">
      <span aria-hidden="true" className="w-12 shrink-0 font-semibold first-letter:uppercase">
        {weekdayLabel(day, locale, "short")}
      </span>
      <div className="min-w-0 flex-1">
        <SegmentedControl
          block
          label={weekdayLabel(day, locale)}
          options={BASELINE_LEVELS.map((level) => ({ value: level, label: t(levelLabelKey(level)) }))}
          value={current ?? ""}
          onValueChange={(level) => onSave(day, levelToPoints(level as BaselineLevel))}
        />
      </div>
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
  return (
    <div className="flex flex-col gap-2 py-3">
      <span aria-hidden="true" className="flex items-center gap-3 font-semibold [overflow-wrap:anywhere]">
        <ChoreIcon category={choreCategory(id)} />
        {name}
      </span>
      <SegmentedControl
        block
        label={name}
        options={PREFERENCES.map((value) => ({ value, label: t(PREFERENCE_KEY[value]) }))}
        value={profile.preferences[id] ?? "neutral"}
        onValueChange={(value) => onChange(id, value as Preference)}
      />
    </div>
  );
}

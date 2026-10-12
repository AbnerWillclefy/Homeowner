import { Ban, Heart, Zap } from "lucide-react";
import { SectionCard } from "../shared/ui/SectionCard";
import { useI18n } from "../shared/i18n";
import { BaselineFields, PreferenceFields, ProfileStatus, RestrictionFields } from "./ProfileSections";
import { useProfile } from "./useProfile";

/**
 * The first part of the Me tab: the signed-in User's Baseline, Preferences and Restrictions, each in its own
 * titled card (an h3 and a region, under the tab's h2). Each control saves on its own: the change shows at once and is undone
 * with an error toast if the API refuses it, and a toast says it was saved. Baseline saves on blur. Onboarding shows the same three
 * parts one step at a time.
 *
 * While the details load or fail, only the status shows (with Retry), never empty cards. It renders a
 * fragment: MePage owns the column and the cards that follow.
 */
export function MeProfile() {
  const { t } = useI18n();
  const { state, retry, setBaseline, setPreference, setRestricted } = useProfile();

  return (
    <>
      {/* Load problems only; each save or undo is a toast, announced once by the toast region. */}
      <ProfileStatus state={state} retry={retry} />

      {state.kind === "ready" && (
        <>
          <SectionCard id="me-baseline-heading" icon={Zap} title={t("profile.baseline.heading")} hint={t("profile.baseline.hint")}>
            <BaselineFields baseline={state.profile.baseline} onSave={setBaseline} />
          </SectionCard>

          <SectionCard
            id="me-preferences-heading"
            icon={Heart}
            title={t("profile.preferences.heading")}
            hint={t("profile.preferences.hint")}
          >
            <PreferenceFields profile={state.profile} categories={state.categories} onChange={setPreference} />
          </SectionCard>

          <SectionCard
            id="me-restrictions-heading"
            icon={Ban}
            title={t("profile.restrictions.heading")}
            hint={t("profile.restrictions.hint")}
          >
            <RestrictionFields
              restrictions={state.profile.restrictions}
              demands={state.demands}
              onChange={setRestricted}
            />
          </SectionCard>
        </>
      )}
    </>
  );
}

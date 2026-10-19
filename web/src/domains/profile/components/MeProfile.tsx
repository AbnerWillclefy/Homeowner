import { Ban, Heart, Zap } from "lucide-react";
import { CollapsibleCard } from "../../../shared/ui/CollapsibleCard";
import { useI18n } from "../../../shared/i18n";
import { BaselineFields, PreferenceFields, ProfileStatus, RestrictionFields } from "./ProfileSections";
import { useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { useProfile } from "../hooks/useProfile";
import { ProfileSkeleton } from "./ProfileSkeleton";

/**
 * The first part of the Me tab: the signed-in User's Baseline, Preferences and Restrictions, each in its own
 * collapsible card, closed on first view (an h3 holding the toggle button, and a region, under the tab's h2). Each control saves on its own: the change shows at once and is undone
 * with an error toast if the API refuses it, and a toast says it was saved. Baseline saves on blur. Onboarding shows the same three
 * parts one step at a time.
 *
 * While the details load, only the skeleton shows; when they fail, only the alert and Retry. Never empty cards. It renders a
 * fragment: MePage owns the column and the cards that follow.
 */
export function MeProfile() {
  const { t } = useI18n();
  const { state, retry, setBaseline, setPreference, setRestricted } = useProfile();

  // The page's one status announces the wait; the skeleton shows after 300ms. Only the first load and a Retry load.
  const showSkeleton = useReportFirstLoad(state.kind === "loading");

  return (
    <>
      {showSkeleton && <ProfileSkeleton />}
      {/* Load problems only; each save or undo is a toast, announced once by the toast region. */}
      <ProfileStatus state={state} retry={retry} />

      {state.kind === "ready" && (
        <>
          <CollapsibleCard id="me-baseline-heading" icon={Zap} title={t("profile.baseline.heading")} hint={t("profile.baseline.hint")}>
            <BaselineFields baseline={state.profile.baseline} onSave={setBaseline} />
          </CollapsibleCard>

          <CollapsibleCard
            id="me-preferences-heading"
            icon={Heart}
            title={t("profile.preferences.heading")}
            hint={t("profile.preferences.hint")}
          >
            <PreferenceFields profile={state.profile} categories={state.categories} onChange={setPreference} />
          </CollapsibleCard>

          <CollapsibleCard
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
          </CollapsibleCard>
        </>
      )}
    </>
  );
}

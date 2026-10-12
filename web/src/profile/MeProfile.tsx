import { Card } from "../components/ui/Card";
import { useI18n } from "../i18n";
import { BaselineFields, PreferenceFields, ProfileStatus, RestrictionFields } from "./ProfileSections";
import { useProfile } from "./useProfile";

/**
 * The first part of the Me tab: the signed-in User's Baseline, Preferences and Restrictions, each in its own
 * titled card (an h2 and a region). Each control saves on its own: the change shows at once and is undone
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
          <Card as="section" aria-labelledby="me-baseline-heading">
            <h2 id="me-baseline-heading">{t("profile.baseline.heading")}</h2>
            <BaselineFields baseline={state.profile.baseline} onSave={setBaseline} />
          </Card>

          <Card as="section" aria-labelledby="me-preferences-heading">
            <h2 id="me-preferences-heading">{t("profile.preferences.heading")}</h2>
            <PreferenceFields profile={state.profile} categories={state.categories} onChange={setPreference} />
          </Card>

          <Card as="section" aria-labelledby="me-restrictions-heading">
            <h2 id="me-restrictions-heading">{t("profile.restrictions.heading")}</h2>
            <RestrictionFields
              restrictions={state.profile.restrictions}
              demands={state.demands}
              onChange={setRestricted}
            />
          </Card>
        </>
      )}
    </>
  );
}

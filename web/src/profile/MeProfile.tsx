import { useI18n } from "../i18n";
import { BaselineFields, PreferenceFields, ProfileStatus, RestrictionFields } from "./ProfileSections";
import { useProfile } from "./useProfile";

/**
 * The signed-in User's Baseline, Preferences and Restrictions. Each control saves on its own: the change
 * shows at once and is undone with a visible message if the API refuses it. Baseline saves on blur.
 * Onboarding shows the same three parts one step at a time.
 */
export function Profile() {
  const { t } = useI18n();
  const { state, save, retry, setBaseline, setPreference, setRestricted } = useProfile();

  return (
    <section aria-labelledby="profile-heading">
      <h2 id="profile-heading">{t("profile.heading")}</h2>

      {state.kind !== "ready" && <ProfileStatus state={state} save={save} retry={retry} />}

      {state.kind === "ready" && (
        <>
          <p>{t("profile.intro")}</p>

          {/* One live region for every control, so each save or undo is announced once. */}
          <ProfileStatus state={state} save={save} retry={retry} />

          <section aria-labelledby="profile-baseline-heading">
            <h3 id="profile-baseline-heading">{t("profile.baseline.heading")}</h3>
            <BaselineFields baseline={state.profile.baseline} onSave={setBaseline} />
          </section>

          <section aria-labelledby="profile-preferences-heading">
            <h3 id="profile-preferences-heading">{t("profile.preferences.heading")}</h3>
            <PreferenceFields profile={state.profile} categories={state.categories} onChange={setPreference} />
          </section>

          <section aria-labelledby="profile-restrictions-heading">
            <h3 id="profile-restrictions-heading">{t("profile.restrictions.heading")}</h3>
            <RestrictionFields
              restrictions={state.profile.restrictions}
              demands={state.demands}
              onChange={setRestricted}
            />
          </section>
        </>
      )}
    </section>
  );
}

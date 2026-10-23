import { SignedIn } from "../../../domains/auth/components/SignedIn";
import { MeHeader } from "../../../domains/profile/components/MeHeader";
import { MeProfile } from "../../../domains/profile/components/MeProfile";
import { SettingsCard } from "../../../domains/settings/components/Settings";
import { useI18n } from "../../../shared/i18n";
import { PageLoading } from "../../../shared/ui/PageLoading";
import { useAppAuth } from "../AuthProvider";

/**
 * Me: the header (Avatar, name, email, Streak), then one titled card each for the Baseline, Preferences, Restrictions and the settings (Appearance and
 * Language), then the account card with sign out last. MePage owns the column, so the cards after
 * the Restrictions still show when the details fail to load.
 */
export function MePage() {
  const { t } = useI18n();
  const auth = useAppAuth();
  if (auth.state.kind !== "signed-in") return null;
  return (
    <PageLoading message={t("profile.loading")}>
      <div className="flex flex-col gap-4">
        <MeHeader />
        <MeProfile />
        <SettingsCard />
        {/* Signing out is on purpose: the guard then sends the person to sign-in without remembering this tab. */}
        <SignedIn email={auth.state.email} offline={auth.state.offline} onSignOut={auth.signOut} />
      </div>
    </PageLoading>
  );
}

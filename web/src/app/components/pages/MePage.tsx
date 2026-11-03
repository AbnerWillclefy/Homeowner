import { SignedIn } from "../../../domains/auth/components/SignedIn";
import { MeHeader } from "../../../domains/profile/components/MeHeader";
import { MeProfile } from "../../../domains/profile/components/MeProfile";
import { SettingsCard } from "../../../domains/settings/components/Settings";
import { useI18n } from "../../../shared/i18n";
import { HeadedSection } from "../../../shared/ui/HeadedSection";
import { PageLoading } from "../../../shared/ui/PageLoading";
import { MyCompletions } from "../../../domains/residents/components/MyCompletions";
import { useAppAuth } from "../AuthProvider";
import { useShell } from "../ShellContext";

/**
 * Me: the header (Avatar, name, email, Streak), then two separate parts under the tab's h2, each a section named by
 * an h3: My Completions (only with a Home), and the settings, whose h4 cards are the Baseline, Preferences,
 * Restrictions, Appearance and Language, and the account card with sign out last. MePage owns the settings column,
 * so the cards after the Restrictions still show when the details fail to load.
 */
export function MePage() {
  const { t } = useI18n();
  const auth = useAppAuth();
  const { home } = useShell();
  if (auth.state.kind !== "signed-in") return null;
  return (
    <PageLoading message={t("profile.loading")}>
      <div className="flex flex-col gap-8">
        <MeHeader />
        {/* Only a Resident with a Home has a history; the section stands alone, so the cards below never wait on it. */}
        {home.state.kind === "ready" && <MyCompletions timeZone={home.state.home.timezone} />}
        <HeadedSection title={t("me.settings.heading")}>
          <MeProfile />
          <SettingsCard headingLevel={4} />
          {/* Signing out is on purpose: the guard then sends the person to sign-in without remembering this tab. */}
          <SignedIn email={auth.state.email} offline={auth.state.offline} onSignOut={auth.signOut} />
        </HeadedSection>
      </div>
    </PageLoading>
  );
}

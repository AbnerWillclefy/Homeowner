import { List } from "@homeowner/bedrock";
import { AccountRow } from "../../../domains/auth/components/AccountRow";
import { MeHeader } from "../../../domains/profile/components/MeHeader";
import { MeProfile } from "../../../domains/profile/components/MeProfile";
import { LanguageRow, ThemeRow } from "../../../domains/settings/components/Settings";
import { useI18n } from "../../../shared/i18n";
import { HeadedSection } from "../../../shared/ui/HeadedSection";
import { TabBody } from "../TabBody";
import { TabHeader } from "../TabHeader";
import { PageLoading } from "../../../shared/ui/PageLoading";
import { MyCompletions } from "../../../domains/residents/components/MyCompletions";
import { useAppAuth } from "../AuthProvider";
import { useShell } from "../ShellContext";

/**
 * Me: the header (Avatar, name, email, Streak), then three separate parts under the tab's h1, each a section named
 * by an h3, in the order of the Eu artboard: "how the plan knows you" (rows for the Baseline, Preferences and
 * Restrictions, each opening a Sheet), My Completions (only with a Home), and the App rows (Language, Appearance and the
 * account with sign out, each opening a Sheet). MePage owns the column, so the App rows still show when the
 * profile details fail to load.
 */
export function MePage() {
  const { t } = useI18n();
  const auth = useAppAuth();
  const { home } = useShell();
  if (auth.state.kind !== "signed-in") return null;
  return (
    <PageLoading message={t("profile.loading")}>
      {/* No refresh slot here: MeHeader's name row carries the page's one indicator. */}
      <TabHeader title={t("me.heading")} refresh={false} />
      <TabBody>
        <MeHeader />
        <MeProfile />
        {/* Only a Resident with a Home has a history; the section stands alone, so the rows never wait on it. */}
        {home.state.kind === "ready" && <MyCompletions timeZone={home.state.home.timezone} />}
        <HeadedSection title={t("me.group.app")}>
          <List>
            <LanguageRow />
            <ThemeRow />
            {/* Signing out is on purpose: the guard then sends the person to sign-in without remembering this tab. */}
            <AccountRow email={auth.state.email} offline={auth.state.offline} onSignOut={auth.signOut} />
          </List>
        </HeadedSection>
      </TabBody>
    </PageLoading>
  );
}
